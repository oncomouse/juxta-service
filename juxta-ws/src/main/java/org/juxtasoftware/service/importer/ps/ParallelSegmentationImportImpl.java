package org.juxtasoftware.service.importer.ps;

import java.io.IOException;
import java.io.Reader;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import javax.xml.parsers.ParserConfigurationException;

import org.juxtasoftware.Constants;
import org.juxtasoftware.dao.AlignmentDao;
import org.juxtasoftware.dao.CacheDao;
import org.juxtasoftware.dao.ComparisonSetDao;
import org.juxtasoftware.dao.JuxtaXsltDao;
import org.juxtasoftware.dao.NoteDao;
import org.juxtasoftware.dao.PageBreakDao;
import org.juxtasoftware.dao.SourceDao;
import org.juxtasoftware.dao.WitnessDao;
import org.juxtasoftware.dao.WorkspaceDao;
import org.juxtasoftware.model.CollatorConfig;
import org.juxtasoftware.model.ComparisonSet;
import org.juxtasoftware.model.Note;
import org.juxtasoftware.model.PageBreak;
import org.juxtasoftware.model.Source;
import org.juxtasoftware.model.Witness;
import org.juxtasoftware.model.Workspace;
import org.juxtasoftware.service.ComparisonSetCollator;
import org.juxtasoftware.service.Tokenizer;
import org.juxtasoftware.service.importer.ImportService;
import org.juxtasoftware.service.importer.ps.WitnessParser.WitnessInfo;
import org.juxtasoftware.util.BackgroundTaskSegment;
import org.juxtasoftware.util.BackgroundTaskStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Service;
import org.xml.sax.SAXException;

import eu.interedition.text.Text;
import eu.interedition.text.TextRepository;
import eu.interedition.text.xml.XMLParser;

/**
 * Import service implementation for reading in a TEI parallel segmented
 * xml file, recreating a comparison set with all witnesse, and populating
 * it with all annotations and diff alignments.
 * 
 * @author loufoster
 *
 */
@Service
@Scope(BeanDefinition.SCOPE_PROTOTYPE)
public class ParallelSegmentationImportImpl implements ImportService<Source> {

    @Autowired private JuxtaXsltDao xsltDao;
    @Autowired private SourceDao sourceDao;
    @Autowired private WitnessDao witnessDao;
    @Autowired private NoteDao noteDao;
    @Autowired private CacheDao cacheDao;
    @Autowired private PageBreakDao pageBreakDao;
    @Autowired private ComparisonSetDao setDao;
    @Autowired private WorkspaceDao workspaceDao;
    @Autowired private AlignmentDao alignmentDao;
    @Autowired private TextRepository textRepository;
    @Autowired private Tokenizer tokenizer;
    @Autowired private ComparisonSetCollator collator;
    @Autowired private WitnessParser witnessParser;
    @Autowired private XMLParser xmlParser;
        
    private ComparisonSet set;
    private Set<Witness> preExistingWitnesses;
    private BackgroundTaskStatus taskStatus = null;
    private BackgroundTaskSegment taskSegment = null;
    private List<WitnessInfo> listWitData = new ArrayList<WitnessInfo>();
    private boolean deferCollation = false;
    
    private static final Logger LOG = LoggerFactory.getLogger( ImportService.class.getName());
    
    public ParallelSegmentationImportImpl() {  
    }
    
    public void reimportSource(ComparisonSet set, Source importSrc) throws Exception {
        this.deferCollation = true;
        doImport(set, importSrc, null);
    }
    
    @Override
    public void doImport(ComparisonSet set, Source importSrc, BackgroundTaskStatus status)
        throws Exception {
        
        // save key data for use later
        this.set = set;
        this.taskStatus = status;
        
        if ( this.taskStatus != null ) {
            // set up the number of segments in the task
            int numSteps = 5;
            if ( this.deferCollation ) {
                numSteps = 3;
            }
            this.taskSegment = this.taskStatus.add(1, new BackgroundTaskSegment( numSteps ));
        }
        
        LOG.info("Import parallel segmented document into '"+this.set.getName()+"'");
        
        prepareSet();
        extractWitnessIdentifiers( importSrc );
        parseSource( importSrc );
        
        if ( this.deferCollation == false ) {
            set.setStatus(ComparisonSet.Status.COLLATING);
            this.setDao.update(this.set);
            
            CollatorConfig cfg = this.setDao.getCollatorConfig(this.set);
            tokenize(cfg);
            collate( cfg );
            
            set.setStatus(ComparisonSet.Status.COLLATED);
            this.setDao.update(this.set);
        }
        
        setStatusMsg("Import successful");
    }
    
    /**
     * Prepare the set to receive new data - clear out
     * old cache and witnesses
     */
    private void prepareSet() {
        // grab all witnesses associated with this set.
        // If there are none, there is nothing more to do
        this.preExistingWitnesses = this.setDao.getWitnesses(this.set);
        if ( this.preExistingWitnesses.size() == 0) {
            return;
        }
        
        // clear out all prior data (note that delete witnesses causes a purge 
        // of all alignment ant tokenization data)
        this.setDao.deleteAllWitnesses(this.set);
        this.cacheDao.deleteHeatmap(set.getId());
        this.alignmentDao.clear(this.set, true); // true to force clear ALL for this set
        try {
            // clear out all pre-existing witness supporting data,
            // but leave the witness itself. It will be updated 
            // with the re-parsed content from the source later.
            for (Witness witness : this.preExistingWitnesses) {
                this.noteDao.deleteAll( witness.getId() );
                this.pageBreakDao.deleteAll( witness.getId() );
            }
            
            incrementStatus();

        } catch (Exception e) {
            throw new RuntimeException("Import failed", e);
        }
    }
    
    private void incrementStatus() {
        if ( this.taskSegment != null ) {
            this.taskSegment.incrementValue();
        }
    }
    
    private void setStatusMsg( final String msg ) {
        if (this.taskStatus != null ) {
            this.taskStatus.setNote(msg);
        }
    }
    
    /**
     * Collate the comparison set
     * @throws IOException
     */
    private void collate( CollatorConfig cfg ) throws IOException {
        setStatusMsg("Collating comparison set");
        this.collator.collate(this.set, cfg, this.taskStatus);
        incrementStatus();
    }
    
    /**
     * Tokenize the comparison set
     * @param cfg  
     * @throws IOException
     */
    private void tokenize( CollatorConfig cfg ) throws IOException {
        setStatusMsg("Tokenizing comparison set");
        this.tokenizer.tokenize(this.set, cfg, this.taskStatus);
        incrementStatus();
    }
    
    /**
     * Scan the source data from witList data and generate a 
     * list of witnesses included in the file
     * 
     * @param importStream
     * @throws IOException 
     * @throws SAXException 
     * @throws ParserConfigurationException 
     */
    private void extractWitnessIdentifiers(Source teiSource) throws ParserConfigurationException, SAXException, IOException {
        setStatusMsg("Extract witness information");
        Reader r = this.sourceDao.getContentReader(teiSource);
        this.witnessParser.parse( r );
        this.listWitData = this.witnessParser.getWitnesses();
        incrementStatus();
    }

    /**
     * Run the TEI PS source thru the xml parser
     * and collect witness/diff info
     * 
     * @param teiSource
     * @throws Exception 
     */
    private void parseSource(Source teiSource ) throws Exception {
        // TODO
//        setStatusMsg("Parse "+set.getName());
//        Workspace publicWs = this.workspaceDao.getPublic();
//        Template template = this.templateDao.find(publicWs, Constants.PARALLEL_SEGMENTATION_TEMPLATE);
//        Workspace ws = this.workspaceDao.find(this.set.getWorkspaceId());
//        
//        // run the src text thru the parser for multiple passes
//        // once for each witness listed in the listWit tag.
//        Set<Witness> witnesses = new HashSet<Witness>();
//        for ( WitnessInfo info : this.listWitData ) {
//            
//            setStatusMsg("Parse WitnessID "+info.getGroupId()+" - '"+info.getDescription()+"' from source");
//            PsXmlParserConfig cfg = new PsXmlParserConfig( template, info );
//            Text witnessTxt = this.xmlParser.parse(teiSource.getText(), cfg);
//            Witness witness = createWitness( ws, teiSource, template, witnessTxt, info );
//            witnesses.add(witness);
//            if ( cfg.notesIncluded()  ) {
//                writeNotes(witness, cfg.getNotes() );
//            }
//            if ( cfg.pageBreaksIncluded()) {
//                writePageBreaks(witness, cfg.getPageBreaks() );
//            }
//        }
//        
//        // add all witnesses to the set
//        setStatusMsg("Create comparison set");
//        this.setDao.addWitnesses(this.set, witnesses);
//        this.setDao.update(this.set);
//        incrementStatus();
        
    }
    
    /**
     * Create a new witness if none was pre-existing. Update the text content
     * of one that already existed.
     * 
     * @param ws
     * @param source
     * @param template
     * @param witnessTxt
     * @param info
     * @return
     * @throws Exception
     */
//    Witness createWitness(Workspace ws, Source source, Template template, Text witnessTxt, WitnessInfo info ) throws Exception{
//        Witness witness = null;
//        
//        // See if there are witnesses that existed and were
//        // attached to the target set
//        for (Witness oldWit : this.preExistingWitnesses ) {
//            if ( oldWit.getName().equals(info.getName())) {
//                witness = oldWit;
//                break;
//            }
//        }
//        
//        // still none, see if an identically named witness exists
//        if (witness == null ) {
//            witness = this.witnessDao.find(ws, info.getName());
//        }
//        
//        // Just create a new one if we still are null
//        if ( witness == null ) {
//            witness = new Witness();
//            witness.setName( info.getName() );
//            witness.setSourceId( source.getId());
//            witness.setXsltId(template.getId());
//            witness.setWorkspaceId( this.set.getWorkspaceId() );
//            witness.setText(witnessTxt);
//            Long id = this.witnessDao.create(witness);
//            witness.setId( id );
//        } else {
//            Text oldTxt = witness.getText();
//            this.witnessDao.updateContent(witness, witnessTxt);
//            
//            // now it is safe to kill the original text text
//            this.textRepository.delete( oldTxt );
//        }
//        
//        return witness;
//    }
    
    public void writeNotes( final Witness w, List<Note> notes) {
        if (!notes.isEmpty()) {
            for (Note note : notes) {
                note.setWitnessId(w.getId());
            }
            this.noteDao.create(notes);
        }
    }
    
    public void writePageBreaks( final Witness w, List<PageBreak> breaks) {
        if ( breaks.isEmpty() == false ) {
            for ( PageBreak pb : breaks ) {
                pb.setWitnessId(w.getId());
            }
            this.pageBreakDao.create(breaks);
        }
    }
}
