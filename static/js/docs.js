$(function() {
  /*
  
    style markdown components
    
  */
  $('.docs-content table')
    .css({
      borderCollapse: 'collapse',
    })
    .show()

  $('.docs-content table th,td')
    .css({
      padding: '10px',
      border: '1px solid #ccc'
    })

  if(EQUALIZE_TABLE_WIDTHS) {
    $('.docs-content table td')
    .css({
      width: EQUALIZE_TABLE_WIDTHS
    })
  }


  /*
  
    sidebar drop-downs
    
  */
  function setupSidebarMenu() {
    $('div[data-menu-type]').each(function() {
      var link = $(this)
      var type = link.attr('data-menu-type')
      var id = link.attr('data-menu-id')
      var url = link.attr('data-menu-url')

      var childrenContent = $('#menu-children-' + id)

      link.click(function(e) {
        if(type == 'leaf') return
        e.preventDefault()
        e.stopPropagation()

        if(childrenContent.hasClass('open')) {
          childrenContent.removeClass('open')
        }
        else {
          childrenContent.addClass('open')  
        }

      })
    })
  }

  setupSidebarMenu()

  /*
  
    algolia search
    
  */

  // how many chars either side of a match to display in the results
  var SEARCH_HIGHLIGHT_BLEED = 30

  function getMatchIndex(text, search) {
    return text.toLowerCase().indexOf(search.toLowerCase())
  }

  function setupAlgolia() {
    var search = instantsearch({
      appId: ALGOLIA_APP_ID,
      apiKey: ALGOLIA_API_KEY,
      indexName: ALGOLIA_INDEX_NAME,
      routing: true,
      searchParameters: {
        hitsPerPage: 5,
        attributesToRetrieve: ['title', 'objectID', 'sectionTitles', 'url', 'sectionURL', 'content'], 
        attributesToHighlight: ['title', 'objectID', 'sectionTitles', 'url', 'sectionURL', 'content'],
      },
      searchFunction: function(helper) {
        var searchResults = $('#search-hits');
        if (helper.state.query === '') {
          searchResults.hide()
        }
        else {
          searchResults.show()
        }
        helper.search()
      }
    })

    search.addWidget(
      instantsearch.widgets.searchBox({
        container: '#search-box',
        placeholder: 'Search for pages',
        cssClasses: {
          root: 'search-box-root',
          input: 'search-box-input',
        },
        reset: true,
        magnifier: true,
      })
    )

    search.addWidget(
      instantsearch.widgets.hits({
        container: '#search-hits',
        templates: {
          empty: [
            '<div class="search-hits-empty">',
                'no results',
            '</div>',
          ].join("\n"),
          item: [
            '<div class="search-hits-row">',
              '<div class="search-hits-section">',
                '<a href="{{{sectionURL}}}">',
                  '{{{_highlightResult.sectionTitles.value}}}',
                '</a>',
              '</div>',
              '<div class="search-hits-page">',
                '<a href="{{{url}}}">',
                  '{{{_highlightResult.title.value}}}',
                '</a>',
              '</div>',
              '<div class="search-hits-matches">',
                '<a href="{{{url}}}">',
                  '{{{_resultMatches}}}',
                '</a>',
              '</div>',
            '</div>',
          ].join("\n")
        },
        transformData: {
          item: function(item) {

            const re = new RegExp('^.*?<p>', 's')

            var highlightResult = item._highlightResult.content
            var searchWords = highlightResult.matchedWords
            var processedText = (highlightResult.value || '').replace(re, '<p>')
            var text = $(processedText).text()

            var allWords = searchWords.join(' ')

            var foundTerms = {}

            var resultMatches = searchWords
              .filter(function(word) {
                return getMatchIndex(text, word) >= 0
              })
              .map(function(word) {
                var firstMatch = getMatchIndex(text, word)
                
                var startMatch = firstMatch - SEARCH_HIGHLIGHT_BLEED
                if(startMatch < 0) startMatch = 0

                var endMatch = firstMatch + word.length + SEARCH_HIGHLIGHT_BLEED
                if(endMatch > text.length-1) endMatch = text.length-1

                var textChunk = text.substring(startMatch, endMatch)

                searchWords.forEach(function(word) {
                  textChunk = textChunk.replace(new RegExp(word, 'gi'), '<em>' + word + '</em>')
                })

                return '...' + textChunk + '...'
              })
              .filter(function(match) {
                var matchingChunk = match.match(/\<.*\>/)[0]
                if(!matchingChunk) return true
                if(foundTerms[matchingChunk]) return false
                foundTerms[matchingChunk] = true
                return true
              })

            if(resultMatches.length > 3) {
              resultMatches = resultMatches.slice(0,3)
            }

            item._resultMatches = resultMatches.join('<br />')
            return item
          },
        }
      })
    )

    search.start()

    $('#search-container').show()
    $('#search-container-holding-space').hide()
  }

  if(ALGOLIA_APP_ID && ALGOLIA_API_KEY && ALGOLIA_INDEX_NAME && $('#search-box').length >= 1) {
    setupAlgolia()
  }
  

  /*
  
    versions drop-down
    
  */

  function activateVersionMenu() {
    var allVersions = VERSIONS_ALL.split(',')
    allVersions.forEach(function(version) {
      var versionOption = $('<li class="mdl-menu__item">Version ' + version + '</li>')

      versionOption.click(function() {
        var url = location.protocol + '//' + version + '.' + VERSIONS_BASE_URL
        document.location = url
      })
      
      $('#version-menu #version-menu-options').append(versionOption)
    })
    $('#version-menu #text-button').text('Version: ' + VERSIONS_CURRENT)
  }

  if(VERSIONS_BASE_URL) {
    activateVersionMenu()
    $('#version-menu-dropdown').css({
      visibility: 'visible'
    })
  }
  
  /*
  
    scrollspy
    
  */

  var SCROLLSPY_FIXED_OFFSET = 170
  var SCROLLSPY_ACTIVE_BUFFER = 150
  var SCROLLSPY_HEADER_SELECTOR = "h2,h3"

  var scrollspyContainer = $('#scrollspy-container')
  var scrollspyList = $('#scrollspy-list')
  var scrollspyNav = $('#scrollspy-container nav')
  var pageContent = $('#page-content')

  var scrollWindow = $(window)

  function highlightScrollLink(id) {
    if(!id) return
    $('.scrollspy-item').removeClass('active')
    $('#scrollspy-menu-' + id.replace('#', '')).addClass('active')
  }

  var clickLinkHash = null

  function checkScrollPositions() {

    var windowScroll = scrollWindow.scrollTop()

    if(clickLinkHash) {
      clickLinkHash = null
      return
    }

    var allElements = pageContent.find(SCROLLSPY_HEADER_SELECTOR)
    var windowHeight = $(window).height()

    var elementsAboveFold = []

    for(var i=0; i<allElements.length; i++) {
      var headerItem = allElements.eq(i)
      var headerItemPosition = headerItem.offset().top - windowScroll

      if(headerItemPosition < SCROLLSPY_ACTIVE_BUFFER) {
        elementsAboveFold.push(headerItem)
      }
    }

    var activeElement = elementsAboveFold.length > 0 ? elementsAboveFold[elementsAboveFold.length-1] : null

    if(!activeElement) {
      $('.scrollspy-item').removeClass('active')
      return
    }

    highlightScrollLink(activeElement.attr('id'))

    const newHashId = activeElement.attr('id')
    const currentHashId = window.location.hash.replace('#', '')

    if(newHashId && newHashId != currentHashId) {
      
      if(history.pushState) {
        history.pushState(null, null, '#' + newHashId)
      }
      else {
        location.hash = '#' + activeElement.attr('id')
      }
    }
  }

  function setupInitialScrollPosition() {
    const currentHashId = window.location.hash.replace('#', '')
    if(!currentHashId) return
    const headerItem = $('#' + currentHashId)
    if(headerItem.length <= 0) return
    scrollWindow.scrollTop(headerItem.offset().top - 140)
  }

  scrollWindow.scroll(function() {
    checkScrollPositions()
  })

  function setupScrollspyMenu() {
    if(scrollspyContainer.length <= 0) return
    
    pageContent.find(SCROLLSPY_HEADER_SELECTOR).each(function() {
      var headerItem = $(this)
      var scrollItem = $('<li></li>')
      var scrollItemLink = $('<a href="#' + headerItem.attr('id') + '">' + headerItem.text() + '</a>')

      scrollItemLink.click(function(e) {
        setTimeout(function() {
          clickLinkHash = headerItem.attr('id')
          highlightScrollLink(clickLinkHash)
          scrollWindow.scrollTop(headerItem.offset().top - 140)
        })
      })

      scrollItem.append(scrollItemLink)      
      scrollItem.addClass('scrollspy-item')
      scrollItem.addClass('scrollspy-' + headerItem.prop("tagName"))
      scrollItem.attr('id', 'scrollspy-menu-' + headerItem.attr('id'))
      scrollspyList.append(scrollItem)
    })

    pageContent.find("h2,h3,h4,h5,h6").each(function() {
      var headerItem = $(this)
      var headerLink = $('<a></a>')
      headerLink.attr({
        href: '#' + headerItem.attr('id')
      })
      headerItem.prepend(headerLink)
    })
  }

  setupScrollspyMenu()
  checkScrollPositions()
  setupInitialScrollPosition()

  /*
  
    footer padding
    
  */

  var footerElem = $('.docs-footer')
  var footerElemPadding = $('.docs-footer-padding')

  function checkFooterPadding() {

    footerElem.css({
      display: 'block'
    })

    var footerOffset = footerElem.offset().top
    var documentHeight = scrollWindow.height()

    // give the foot a top-margin for short documents
    if(footerOffset < documentHeight) {
      var footerHeightOffset = documentHeight - footerOffset
      footerElemPadding.css({
        height: footerHeightOffset + 'px',
      })
    }
  }

  checkFooterPadding()

  /*
  
    copy paste
    
  */
  $('.highlight').each(function(i) {
    var highlightElem = $(this)
    var codeElem = highlightElem.find('pre code')
    var copyDiv = $([
      '<div class="copy-link">',
        '<button class="mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab">',
          '<i class="material-icons" id="clipboard-icon-' + i + '">assignment</i>',
          '<div class="mdl-tooltip mdl-tooltip--small" for="clipboard-icon-' + i + '">',
            'copy to clipboard',
          '</div>',
        '</button>',
      '</div>'
    ].join("\n"))

    highlightElem.prepend(copyDiv)

    copyDiv.click(function() {

      var $temp = $("<textarea>" + codeElem.text() + "</textarea>")
      $("body").append($temp)
      $temp.select()
      document.execCommand("copy")
      $temp.remove()

      copyDiv
        .find('button')
        .addClass('mdl-button--primary')

      setTimeout(function() {
        copyDiv
          .find('button')
          .removeClass('mdl-button--primary')

      }, 1000)
    })
  })

  /*
  
    drop down menus
    
  */
  function showDropDownMenu(menu) {
    var link = menu.parent()
    var position = link.position()
    var linkWidth = link.width()
    var menuWidth = menu.width()
    menu.css({
      left: position.left + (linkWidth/2) - (menuWidth/2),
      top: position.top + 30,
    })
    menu.show()
  }

  function setupDropDownMenus() {
    $('a[data-dropdown]').each(function() {
      var menuLink = $(this)
      var menuId = menuLink.attr('data-dropdown')
      var menu = $('#' + menuId)

      menu.click(function(e) {
        e.stopPropagation()
      })

      menuLink.click(function(e) {
        e.preventDefault()
        e.stopPropagation()

        if(menu.is(':visible')) {
          menu.hide()
        }
        else {
          $('.dropdown-menu').hide()
          showDropDownMenu(menu)
          
        }
      })
    })

    $('body').click(function() {
      $('.dropdown-menu').hide()
    })

    $(window).resize(function() {
      $('a[data-dropdown]').each(function() {
        var menuLink = $(this)
        var menuId = menuLink.attr('data-dropdown')
        var menu = $('#' + menuId)

        if(menu.is(':visible')) {
          showDropDownMenu(menu)
        }
      })
    })
  }

  setupDropDownMenus()
})