/**
 * Javascript to support the heatmap visualization
 */
/*global $, document, Raphael, alert, window, location */

if (!window.Juxta) {
   window.Juxta = {};
}
if (!window.Juxta.Heatmap) {
   window.Juxta.Heatmap = {};
}

$(function() {

   /**
    * Get the maximum, non-scrolling height for the heatmap content area
    */
   var getMaxNonScrollHeight = function() {
      var maxH = $("#juxta-ws-content").parent().height();
      var headerH = $(".header").outerHeight();
      if ( $("#condensed-header").exists() ) {
         headerH = $("#condensed-header").outerHeight();   
      }
      var extraH = headerH + $(".heatmap-toolbar").outerHeight();
      if ($("#condensed").text() === "true") {
         extraH = extraH + $("#condensed-heatmap-footer").outerHeight();
      }
      return (maxH - extraH );
   };

   /**
    * Create raphael canvases to use when drawing the change index circles
    */
   var renderWitnessChangeIndexes = function() {
      var attribs = {
         stroke : '#000',
         'stroke-width' : 0.5
      };
      var fill = {
         stroke : '#BBC1FF',
         'stroke-width' : 0,
         fill: '#BBC1FF'
      };
      
      var idxJson = $.parseJSON( $("#witness-change-indexes").text() );      
      var colors = ["#FFFFFF", "#EFF0FF", "#D5D9FF", "#BBC1FF", "#A1AAFF", "#8792FF", "#6D7BFF", "#5363FF"];
      var dim = "#aaa";
      var dark = "#000";
      var witId;
      var changeIndex;
      $(".change-index").each(function(index) {
         witId = $(this).attr("id").substring("change-index-".length);
         $.each( idxJson, function(idx, obj) {
            if (obj.id === parseInt(witId,10)) {
               changeIndex = obj.ci;
               return false;
            }
         });
         $(this).attr("title", changeIndex + " change index from base text");
         var paper = new Raphael($(this).get(0), $(this).width(), 10);
         $(this).data("paper", paper);
         var box = paper.rect(0, 0, $(this).width(), 10);
         box.attr(attribs);
         box = paper.rect(1, 1, $(this).width()*changeIndex, 8);
         box.attr(fill);
      });
   };

   /**
    * Purge the cached heatmap data and re-render the contents
    */
   var refreshHeatmap = function() {

      // send an ajax DELETE to purge the heatmap cache for this set. Once
      // successful, just reload the page to get the updated view
      var setId = $('#setId').text();
      var csUrl = $('#ajax-base-url').text() + setId + $('#view-heatmap-segment').text();
      $.ajax({
         url : csUrl,
         type : 'DELETE',
         async : false,
         success : function() {
            location.reload();
         },
         error : function(jqXHR, textStatus, errorThrown) {
            alert("Unable refresh heatmap view:\n\n" + jqXHR.responseText);
         }
      });
   };

   /**
    * Show a note or margin box in the gutter, and align it with the specified top position
    */
   var showAndAlign = function(top, tgtEle, tgtClass, ownerDiv) {
      tgtEle.width(ownerDiv.width() - 8);
      tgtEle.css({
         position : "relative",
         margin : 0,
         marginTop : 0,
         top : top
      });
      tgtEle.show();

      var bot = tgtEle.position().top + tgtEle.outerHeight();
      if (bot > ownerDiv.height()) {
         ownerDiv.height(bot);
      }
   };

   /**
    * Layout notes boxes in the right-side gutter
    */
   var layoutNotes = function() {

      var scrollPos = $(".heatmap-scroller").position().top;
      var scrollTop = $(".heatmap-scroller").scrollTop();
      var lastTop = -1;
      var totalHeight = 0;
      var top = 0;
      var firstTop = -1;

      // iterate over each note and find its anchor. align
      // the top of the note with the top of the anchor
      $(".note").each(function(index) {
         var noteId = $(this).attr("id");
         var anchorId = "note-anchor-" + noteId.substring(5);
         var anchor = $("#" + anchorId);

         if (anchor.exists()) {
            // the first note just gets positioned directly.
            if (lastTop === -1) {
               top = anchor.position().top - scrollPos + scrollTop;
            } else {
               // all others are positioned relateve and need to bump
               // their top pos by the accumulated height of all others
               var newTop = anchor.position().top - scrollPos + scrollTop;
               if (newTop <= (lastTop + totalHeight)) {
                  // this overlaps the prior note. Just bump the top
                  // 5 piles down (relative to the prior)
                  top += 5;
               } else {
                  top += (newTop - lastTop);
                  top -= totalHeight;
               }
            }

            if (firstTop === -1) {
               firstTop = top;
            }

            showAndAlign(top, $(this), 'note', $("#note-boxes"));
            totalHeight += $(this).outerHeight();
            lastTop = top;
         }
      });

      // if the new layout pushes the height from non-scrolly
      // to scrolly, slap on the scroll bar and reduce the witdth
      // of all of the boxes a bit so the are not chopped off
      // by the newly reduced horizontal space.
      if (firstTop + totalHeight > getMaxNonScrollHeight()) {
         $("#heatmap-scroller").css("overflow-y", "visible");
         $(".note").width($(".note").width() - 10);
      }
   };

   /**
    * Toggle view of revisions
    */
   var toggleRevisionStyle = function() {
      var revTags = $(".rev");
      if ($("#revisions-button").hasClass("pushed") === false) {
         $("#revisions-button").addClass("pushed");
         revTags.removeClass("plain-revs");
         revTags.addClass("reveal");
      } else {
         $("#revisions-button").removeClass("pushed");
         revTags.removeClass("reveal");
         revTags.addClass("plain-revs");
      }
   };
   
   var toggleLineNumbers = function() {
      var lineNumTags = $(".line-number");
      if ($("#line-num-button").hasClass("pushed") === false) {
         $("#line-num-button").addClass("pushed");
         lineNumTags.show();
      } else {
         $("#line-num-button").removeClass("pushed");
         lineNumTags.hide();
      }
   };

   /**
    * Togggle view of page breaks
    */
   var togglePbTags = function() {
      var pbTags = $(".page-break");
      if ($("#pb-button").hasClass("pushed") === false) {
         $("#pb-button").addClass("pushed");
         pbTags.css('visibility', 'visible');
      } else {
         $("#pb-button").removeClass("pushed");
         pbTags.css('visibility', 'hidden');
      }
   };

   /**
    * Toggle view of notes
    */
   var toggleNotes = function() {
      var notes = $(".note-anchor");
      if ($("#notes-button").hasClass("pushed") === false) {
         $("#notes-button").addClass("pushed");
         notes.removeClass("note-anchor-hidden");
         $("#note-boxes").show();
      } else {
         $("#notes-button").removeClass("pushed");
         notes.addClass("note-anchor-hidden");
         $("#note-boxes").hide();
      }
   };

   /**
    * Clear out all margin boxes and replace with note boxes
    */
   var clearBoxes = function() {
      if ( $("#condensed-overlay").exists() ) {
         $("#condensed-overlay").remove();
      }
      
      $("#margin-boxes").fadeOut(250, function() {
         var priorActive = $(".active");
         priorActive.removeClass("active");
         if ($("#condensed").text() === 'true') {
            if ($("#notes-button").data("selected")) {
               $("#note-boxes").fadeIn(250);
               layoutNotes();
            } else {
               $("#heatmap-text").removeClass("dimmed");
            }
         }
      });
   };
   
   var showAnnotation = function(id, note) {
      $('#box-anno-' + id).text(note);
      $('#box-anno-' + id).show();
      $('#del-anno-' + id).show();  
      $('#add-anno-' + id).attr("Title", "Edit annotation"); 
   };

   /**
    * Show all margin boxes for the specified alignment
    */
   var showMarginBoxes = function(alignId) {

      // if we clicked same diff, do nothing otherwise clear the old one
      var priorActive = $(".active");
      if (priorActive.length > 0) {
         var priorId = priorActive.attr("id");
         if (priorId === alignId) {
            return;
         } else {
            priorActive.removeClass("active");
         }
      }

      // FIRST turn on some dimming and a wait cursor
      $("body").trigger('wait-requested');
      $('#wait-popup').show();

      // hide ALL boxes. this to cover case when 1st click shows 4 and 2nd shows 1
      // must ensure that the extra 3 are no longer shown
      $('.margin-box').hide();

      // make an ajax request to get json containing
      // data to fill out the margin boxes with detail
      var src = $("#" + alignId);
      var range = src.attr("juxta:range");
      var setId = $('#setId').text();
      var csUrl = $('#ajax-base-url').text() + setId + $('#fragment-segment').text();
      var url = csUrl + '?range=' + range + "&base=" + $("#baseId").text();
      var filter = $("#witness-filter").text();
      filter = $.trim(filter.replace("[", "").replace("]", "").replace(/\s+/g, ""));
      if (filter.length > 0) {
         url = url + "&filter=" + filter;
      }

      $.ajax({
         contentType : 'application/json',
         accepts : {
            json : 'application/json'
         },
         type : 'GET',
         url : url,
         dataType : 'json',
         success : function(jsonData) {
            // toggle to margin box view
            $("#note-boxes").hide();
            $("#margin-boxes").show();

            // make clicked change active and show margin boxes
            src.addClass("active");

            // figure out the top pos of the clicked diff within the scroll div
            var scrollPos = $(".heatmap-scroller").position().top;
            var scrollTop = $(".heatmap-scroller").scrollTop();
            var boxTop = src.position().top - scrollPos + scrollTop;

            // fill boxes with change data
            var idx;
            for ( idx = 0; idx < jsonData.length; idx += 1) {
               var diff = jsonData[idx];
               var boxId = idx + 1;

               if ( diff.note.length === 0) {
                  $('#box-anno-' + boxId).hide();  
                  $('#del-anno-' + boxId).hide();  
                  $('#add-anno-' + boxId).attr("Title", "Add annotation"); 
               } else {
                  showAnnotation(boxId, diff.note);
               }
               
               // set title with witness name
               var titleEle = $('#box-title-' + boxId);
               titleEle.html(diff.typeSymbol + diff.witnessName);
               $("#mb-wit-id").text(diff.witnessId);
               
               var txtEle = $('#box-txt-' + boxId);
               txtEle.html(diff.fragment);

               if ($("#condensed").text() === 'false') {
                  showAndAlign(boxTop, $("#box-" + boxId), 'margin-box', $("#margin-boxes"));
                  boxTop = boxTop + 5;
               } else {
                  $("#box-" + boxId).show();
               }
            }

            if ($("#condensed").text() === 'true') {
               $('#heatmap-scroller').append("<div id='condensed-overlay'></div>");
               $("#condensed-overlay").height( $("#heatmap-scroller").height());
               $("#condensed-overlay").css( "top", $('#heatmap-scroller').offset().top+"px");
               var help = $("<div/>");
               $("#heatmap-scroller").append(help);
               var w  = help.width();
               help.remove();
               $("#condensed-overlay").width(w);
               $("#condensed-overlay").css("z-index", "1");
               $("#margin-boxes").css("z-index", "1000");

               var bottomY = $("#heatmap-text").position().top + $("#heatmap-text").outerHeight();
               $("#margin-boxes").css("left", ($("#heatmap-text").width() - $("#margin-boxes").width()) / 2);
               // box container is below the text. move it up to alignt with clicked diff
               var t = boxTop - bottomY + $("#condensed-header").outerHeight(true) - $("#heatmap-scroller").scrollTop();
               $("#margin-boxes").css("top",  t);
            }

            $('#wait-popup').hide();
            $("body").trigger('wait-completed');
         },
         error : function(jqXHR, textStatus, errorThrown) {
            alert("Unable to determine differences.\n     " + jqXHR.responseText);
            $('#wait-popup').hide();
            $("body").trigger('wait-completed');
         },
         xhrFields : {
            withCredentials : true
         }
      });
   };

   window.Juxta.Heatmap.toggleVisibility = function(icon) {
      var witnessId = $(icon).attr("id").substring("toggle-".length);
      if ( witnessId === $("#baseId").text()) {
         return;
      }
      var top = $("#heatmap-scroller").scrollTop();
      var full = $("#heatmap-scroller")[0].scrollHeight;
      var percent = top / full;
      
      var p = $(icon).css("background-position");
      if (p.indexOf("16") === -1) {
         $(icon).css("background-position", "0px 16px");
         $("#witness-" + witnessId).addClass("hidden-witness");
         $("#toggle-"+witnessId).attr("title", "Show Witness");
      } else {
         $(icon).css("background-position", "0px 0px");
         $("#witness-" + witnessId).removeClass("hidden-witness");
         $("#toggle-"+witnessId).attr("title", "Hide Witness");
      }

      var by = $("input[name=hm-sort-by]:radio:checked").val();
      var dir = $("input[name=hm-sort]:radio:checked").val();
      var setId = $('#setId').text();
      var csUrl = $('#ajax-base-url').text() + setId + $('#view-heatmap-segment').text() + "base=" + $("#baseId").text()+"&by="+by+"&order="+dir;
      csUrl = csUrl + "&top="+percent.toFixed(5);
      var filter = "";
      $(".visibility-toggle").each(function() {
         p = $(this).css("background-position");
         if (p.indexOf("16") > -1) {
            if (filter.length > 0) {
               filter = filter + ",";
            }
            filter = filter + $(this).attr("id").substring("toggle-".length);
         }
      });

      if (filter.length > 0) {
         csUrl = csUrl + "&filter=" + filter;
      }
      window.location = csUrl;
   };
   
   var sizeWitnessList = function() {
      var maxH = $("#juxta-ws-content").parent().height();
      $("#files").height(maxH);
      $("#files-scroller").height(maxH-$(".header").outerHeight(true) );
      if ( $("#files-content").height() > (maxH-$(".header").outerHeight(true))) {
          $("#files-scroller").css("overflow-y", "scroll");
      } else {
         $("#files-scroller").css("overflow-y", "hidden");
      }
   };

   /**
    * Initialize heatmap size, layout and events
    */
   window.Juxta.Heatmap.initialize = function() {
      
      var reloadSet = function( baseId ) {
         var by = $("input[name=hm-sort-by]:radio:checked").val();
         var dir = $("input[name=hm-sort]:radio:checked").val();
         var setId = $('#setId').text();
         var csUrl = $('#ajax-base-url').text() + setId + $('#view-heatmap-segment').text() + "base=" + baseId+"&by="+by+"&order="+dir;
         window.location = csUrl;
      };
      
      var setSortOrder  = function() {
         var by = $("input[name=hm-sort-by]:radio:checked").val();
         var dir = $("input[name=hm-sort]:radio:checked").val();
         if (by === 'name') {
            $("#files").find(".set-file").tsort({
               order : dir,
               attr : 'title'
            });
         } else {
            $("#files").find(".set-file").tsort({
               order : dir,
               attr : 'juxta:date'
            });
         }
      };

      $("#juxta-ws-content").parent().css("overflow-y", "hidden");

      var h = getMaxNonScrollHeight();
      $(".heatmap-scroller").height(h);
      sizeWitnessList();

      var fullHeight = $(".heatmap-text").outerHeight();
      if (fullHeight < h) {
         $(".heatmap-scroller").css("overflow-y", "hidden");
      }

      // Setup the full heatmap UI as long as we are not in condensed mode
      if ($("#condensed").text() === 'false') {
         
         // set initial sort order
         setSortOrder();
   
         // sort dropdown goodness
         var dd = $("#files").find(".dropdown");
         $("body").on("click", function() {
            $(".dropdown").hide();
         });
         $("#sort-header").on("click", function(event) {
            event.stopPropagation();
            if ($(dd).is(":visible")) {
               $(dd).hide();
            } else {
               $(dd).show();
            }
         }); 
         $("#files .dropdown li").on("click", function(event) {
            event.stopPropagation();
            if ( $(this).attr("id") !== "divider-row") {
               $(".dropdown").hide();
               var btn =  $(this).children(".sort-radio");
               if ( !btn.is(':checked') ) {
                  btn.attr('checked', true);
               } 
               setSortOrder();
            }
         });
         
         var r = $("#files").position().left + $("#files").outerWidth(true);
         $(dd).css("left", (r - $(dd).outerWidth()) + "px");

         // initially, notes and pagebreaks are displayed. set buttons to pushed
         $("#notes-button").addClass("pushed");
         $("#pb-button").addClass("pushed");
         $("#line-num-button").addClass("pushed");

         // create a bunch of raphael canvases
         // for the non-base witnesses. Render the colored
         // blocks in them to indicate change index
         renderWitnessChangeIndexes();

         // space the note boxes in the margins and handle highlighting
         // note / anchor pairs on mouse movement
         layoutNotes();
         $("#note-boxes").on("mouseenter", ".note", function(event) {
            var noteId = $(this).attr("id");
            $(this).addClass("highlighted");
            var anchorId = "note-anchor-" + noteId.substring(5);
            var anchorSpan = $("#" + anchorId);
            anchorSpan.removeClass("note-anchor");
            anchorSpan.addClass("note-anchor-highlighted");
         });
         $("#note-boxes").on("mouseleave", ".note", function(event) {
            var noteId = $(this).attr("id");
            $(this).removeClass("highlighted");
            var anchorId = "note-anchor-" + noteId.substring(5);
            var anchorSpan = $("#" + anchorId);
            anchorSpan.removeClass("note-anchor-highlighted");
            anchorSpan.addClass("note-anchor");
         });

         // change base witness by clicking on name in witness list on left
         $(".witness").on("click", function() {
            var witnessId = $(this).attr("id").substring("witness-".length);
            if ( $(this).hasClass("hidden-witness") ) {
               window.Juxta.Heatmap.toggleVisibility( $("#toggle-"+witnessId) );
            } else {
               reloadSet(witnessId);
            }
         });
      } else {
         // show the pick base popover
         $("#condensed-list-button").on("click", function() {
            $(".witness-option").each(function(index) {
               if ($(this).attr("id") === $("#baseId").text()) {
                  $(this).attr("selected", "selected");
               }
            });

            $('.condensed-witnesses-popup').css({
               "top" : $(this).position().top + $(this).outerHeight() - $('#pick-base-popup').outerHeight() + "px",
               "left" : $(this).position().left + "px"
            });
            $('#pick-base-popup').show();
         });

         // pick new base
         $("#base-ok-button").on("click", function() {
            var newBaseId = "";
            $(".witness-option").each(function(index) {
               if ($(this).attr("selected") === "selected") {
                  newBaseId = $(this).attr("id");
               }
            });
            reloadSet(newBaseId);
         });
         $("#base-cancel-button").on("click", function() {
            $('#pick-base-popup').hide();
         });
      }

      $.each($.parseJSON($("#witness-filter").text()), function(idx, witId) {
         $("#toggle-" + witId).css("background-position", "0px 16px");
         $("#change-index-" + witId).hide();
         $("#witness-" + witId).addClass("hidden-witness");
         $("#toggle-"+witId).attr("title", "Show Witness");
      });

      $(".visibility-toggle").on("click", function() {
         window.Juxta.Heatmap.toggleVisibility($(this));
      });

      // clicks on background clear boxes
      // and revert to note display
      $("body").click(function() {
         if ( $(".edit-annotation-popup").is(":visible") === false ) {
            clearBoxes();
         }
      });

      // click heatmap to show margin box
      $("#heatmap-text").on("click", ".heatmap", function(event) {
         showMarginBoxes($(this).attr("id"));
         event.stopPropagation();
      });
      
      // add annotation
      $(".hm-anno").on("click", function(event) {
         event.stopPropagation();
         $("#src-mb-id").text( $(this).attr("id").substring("add-anno-".length) );
         var b = $(this).closest(".margin-box");
         $(".edit-annotation-popup").width( b.width() );
         var w = $(".edit-annotation-popup").width();
         var m = parseInt($("#annotation-editor").css("margin-left" ),10)*2;
         $("#annotation-editor").width( w-m );
         $(".edit-annotation-popup").css("left", (b.position().left+b.outerWidth(true)-$(".edit-annotation-popup").outerWidth(true))+"px");
         $(".edit-annotation-popup").css("top", (b.position().top+b.outerHeight(true)+5)+"px");
         $("#annotation-editor").val("");
         $(".edit-annotation-popup").show();
         $("#annotation-editor").focus();
      });
      $("#anno-ok-button").on("click", function(event) {
         event.stopPropagation();
         var data = {};
         var r = $("#heatmap-text .heatmap.active").attr("juxta:range").split(",");
         data.base = $("#baseId").text();
         data.witness = $("#mb-wit-id").text();
         data.note = $("#annotation-editor").val();
         data.start = r[0];
         data.end = r[1];
         $.ajax({
           type: "POST",
           url: $('#ajax-base-url').text() + $('#setId').text() + $('#annotate-segment').text(),
           data: JSON.stringify(data),
           contentType : 'application/json',
           success: function() {  
              $(".edit-annotation-popup").hide();
              showAnnotation($("#src-mb-id").text(), data.note); }
         });         
      });
      $("#anno-cancel-button").on("click", function(event) {
         event.stopPropagation();
         $(".edit-annotation-popup").hide();
         $("#annotation-editor").val("");
      });

      // hook up event handlers for the heatmap toolbar buttons
      $("#refresh-button").on("click", function() {
         refreshHeatmap();
      });
      $("#pb-button").on("click", function() {
         togglePbTags();
      });
      $("#line-num-button").on("click", function() {
         toggleLineNumbers();
      });
      $("#notes-button").on("click", function() {
         toggleNotes();
      });
      $("#revisions-button").on("click", function() {
         toggleRevisionStyle();
      });
   };

   // Let the world know that the heatmap code is now loaded and can be initialized
   if ( $("#heatmap-text").exists() > 0 ) {
      $("body").trigger('heatmap-loaded');
   }
   
   $(window).resize(function() {
      // don't try to do anything if the curr page
      // does not contain a heatmap
      if ($(".heatmap-text").exists()) {

         var h = getMaxNonScrollHeight();
         $(".heatmap-scroller").height(h);
         var fullHeight = $(".heatmap-text").outerHeight();
         if (fullHeight < h) {
            $(".heatmap-scroller").css("overflow-y", "hidden");
         }

         sizeWitnessList();
      
         // easiest to just clear boxes and reset notes on a resize
         clearBoxes();
         layoutNotes();
         
         var dd = $("#files").find(".dropdown");
         var r = $("#files").position().left + $("#files").outerWidth(true);
         $(dd).css("left", (r - $(dd).outerWidth()) + "px");
      }
   });

});
