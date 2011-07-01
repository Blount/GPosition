// ==UserScript==
// @name           GPosition
// @namespace      position-google
// @description    Recherche de position de site ou de page dans le SERP de Google
// @include        http://www.google.*
// @require        http://userscripts.org/scripts/source/44063.user.js
// @version        1.2.4
// ==/UserScript==

if (typeof unsafeWindow == "undefined") {
    unsafeWindow = window;
} else if (unsafeWindow.console) {
    // utiliser pour le debug
    console.log = unsafeWindow.console.log;
}

var version = "1.2.4";

/**
 * Quote regular expression characters.
 * @see http://phpjs.org/functions/preg_quote:491
 * @return string
 */
var preg_quote = function (str, delimiter) {
    return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&');
};


/**
 * Datas manager
 * 
 */
var Storage = new Class({
	
	options : new Hash({
	    displayPosition: true,
	    backupPosition: true,
	    highlightSites: []
	}),
	
	datas : new Hash({
	    onprogress: false,
	    found: false,
	    address: null,
	    position: 0,
	    currentPage: 1,
	    maxPages: 10,
	    version: 2
	}),
	history : new Hash({}),
	
	/**
	 * @todo profile manager using ID.
	 * @param id
	 */
	initialize: function (id) {
		this.load();
	},
	
	load : function () {
	    try {
	        var d = JSON.parse(localStorage.getItem('googlePosition'));
	        var h = JSON.parse(localStorage.getItem('googlePositionHistory'));
	        var o = JSON.parse(localStorage.getItem('googlePositionOptions'));
	    } catch(e) {
	        return;
	    }
	    if (d) {
	        if (!d.version || d.version != this.datas.version) {
	            d = this.datas;
	        }
	        this.datas.extend(d);
	    }
	    if (h) {
	        this.history.extend(h);
	    }
	    if (o) {
	        this.options.extend(o);
	    }
	},
	
	save: function () {
	    localStorage.setItem('googlePosition', JSON.stringify(this.datas));
	    localStorage.setItem('googlePositionHistory', JSON.stringify(this.history));
	    localStorage.setItem('googlePositionOptions', JSON.stringify(this.options));
	},
	
	import: function (string) {
		if ($type(string) != 'string') {
			return;
		}
	    var e = JSON.parse(string);
	    if (e) {
	        if (e.history) {
	        	this.history = e.history;
	        }
	        if (e.options) {
	        	this.options = e.options;
	        }
	    }
	    this.save();
	},
	
	toJsonString: function () {
	    this.save();
	    
	    return JSON.stringify({
	        history: this.history, options: this.options
	    });
	},
	
	
	/**
	 * Erase an URL or all from keyword
	 * @param string name
	 * @param mixed value
	 * @return bool
	 */
	historyEraseUrl: function (keyword, url) {
		if (!url) {
			this.history.erase(keyword);
			return true;
		}
		var urls = this.history.get(keyword);
		if (urls != null && urls.length > 0) {
	        var h = [];
	        for (var i = 0; i < urls.length; i++) {
	            if (urls[i][0] != url) {
	                h.push(urls[i]);
	            }
	        }
	        if (h.length > 0) {
	        	this.history.set(keyword, h);
	        } else {
	        	this.history.erase(keyword);
	        }
	        this.save();
			return true;
		}
		return false;
	},
	
	
	
	/**
	 * Set option. Save after modification.
	 * @param string name
	 * @param mixed value
	 * @return Storage
	 */
	setOption: function (name, value) {
		this.options.set(name, value);
		this.save();
		return this;
	},
	
	/**
	 * Get option
	 * @param string name
	 * @return mixed
	 */
	getOption: function (name) {
		return this.options.get(name);
	}
	
	
});
var storage = new Storage('default');






var insertPosition = function (el) {
    var position = getPosition(el);
    if (position == 0 || document.id('search-'+position)) {
        return;
    }
    el.set('id', 'link-' + position);
    var node = new Element('span', {
        id: 'search-'+position, styles: {color: '#F06F31'},
        'class': 'spanPositionGoogle'
    }).set('text', '#'+position+' - ');
    node.inject(el, 'top');
};

var displayPosition = function () {
    var search = document.id('search');
    if (!search || !storage.getOption('displayPosition')) {
        return;
    }
    
    var lis = search.getElements('li');
    if (lis.length == 0) {
        return;
    }
    
    lis.each(function (li) {
        // box lié à Google Map
        if (li.id == 'lclbox') {
            var h4s = li.getElements('h4');
            h4s.each(function (h4) {
                insertPosition(h4.getElement('a'));
            });
        } else {
            insertPosition(li.getElement('a'));
        }
    });
};


/**
 * @param array sites
 * @return void
 */
var highlightSites = function (sites) {
    var search = document.id('search');
    if (!search) {
        return;
    }
    
    if ($type(sites) != "array") {
    	sites = [sites];
    }
    
    var lis = search.getElements('li');
    if (lis.length == 0) {
        return;
    }
    
    lis.each(function (li) {
        // box lié à Google Map
        if (li.id == 'lclbox') {
            var h4s = li.getElements('h4');
            h4s.each(function (h4) {
            	highlightSite(h4.getElement('a'), sites);
            });
        } else {
        	highlightSite(li.getElement('a'), sites);
        }
    });
};
var highlightSite = function (el, sites) {
	if (el.get('tag') != 'a') {
		return;
	}
	el.setStyle('background', 'transparent');
	sites.each(function (site) {
	    var reg = new RegExp("^"+preg_quote(site)+".*");
		if (el.get('href').match(reg)) {
			el.setStyle('background', '#FFFF00');
		}
	});
};


var getCurrentPage = function () {
    var nav = document.id('nav');
    if (nav) {
        var td = nav.getElement('td.cur');
        if (td) {
            return td.get('text').trim().toInt();
        }
    }
    return 0;
};

/**
 * Retourne le numéro de la position d'un site par rapport à la balise « a »
 * @return int
 */
var getPosition = function(el) {
    if (!el || !el.get('onmousedown')) {
        return 0;
    }
    var matches = el.get('onmousedown').match(/(clk|rwt)\(.*,.*,.*,.*,'([0-9]+)',.*\)/);
    if (matches) {
        return matches[2];
    }
    return 0;
};

/**
 * Sauvegarde la position d'une URL
 * @todo : il faudrait rendre effectif par rapport à la recherche en cours
 */
var backupPosition = function(url, position) {
    if (!storage.getOption('backupPosition')) {
        return;
    }
    
    var search = getSearchKeywords();
    if (!storage.history.has(search)) {
    	storage.history.set(search, []);
    }
    var urls = storage.history.get(search);
    
    if (urls.length > 0) {
        for (var i = 0; i < urls.length; i++) {
            if (urls[i][0] == url) {
            	urls[i][1].push({'time': new Date().getTime(), 'position': position});
            	storage.history.set(search, urls);
                storage.save();
                return;
            }
        }
    }
    
    urls.push([url, [{'time': new Date().getTime(), 'position': position}]]);
	storage.history.set(search, urls);
    storage.save();
};


/**
 * Affiche l'évolution de position d'un site
 */
var displayPositionChange = function (a) {
    if (!storage.getOption('backupPosition')) {
        return;
    }
    var search = getSearchKeywords();
    if (!storage.history.has(search)) {
        return;
    }
    var urls = storage.history.get(search);
    var url = null;
    for (var i = 0; i < urls.length; i++) {
        if (urls[i][0] == a.get('href')) {
        	url = urls[i];
        	break;
        }
    }
    if (!url || url[1].length < 2) {
    	return;
    }
    var positions = url[1];
    var evolution = positions[positions.length-2].position.toInt() - positions[positions.length-1].position.toInt();
    var color = '#FFB900', bColor = '#DDD', bgColor = '#F0F0F0';
    var text;
    if (evolution < 0) {
        color = '#DD2700';
        text = evolution;
    } else if (evolution > 0) {
        color = '#00C025';
        text = '+' + evolution;
    } else {
        color = '#FFB900';
        text = '=';
    }
    var span = new Element('div', {
        text: text,
        styles: {
            position: 'absolute', top: 5, right: 10,
            color: color, 'font-size': 25,
            border: '3px solid ' + bColor,
            'border-radius': '50%',
            padding: '4px 6px',
            background: bgColor
        }
    }).inject(a.getParent('li').setStyle('position', 'relative'), 'top');
};


/**
 * Récupère la recherche en cours
 */
var getSearchKeywords = function () {
    var el = document.id('tsf-oq');
    if (el) {
        el = el.getPrevious('input[name=q]');
        if (el) {
            return el.get('value');
        }
    }
    return '';
};



var searchAddress = function () {
    var search = document.id('search');
    if (!search) {
        return;
    }
    
    var lis = search.getElements('li');
    if (lis.length == 0) {
        return;
    }
    
    var link, position;
    var reg = new RegExp("^"+preg_quote(storage.datas.address)+".*");
    for (var i = 0; i < lis.length; i++) {
        // box lié à Google Map
        if (lis[i].id == 'lclbox') {
            var h4s = lis[i].getElements('h4');
            for (var j = 0; j < h4s.length; j++) {
                link = h4s[j].getElement('a');

                if (link) {
                    position = getPosition(link);
                    if (storage.datas.position < position && link.href.match(reg)) {
                    	storage.datas.found = true;
                    	storage.datas.position = position;
                        h4s[j].getParent().getParent().getParent().setStyles({
                            border: '1px solid #FF0000',
                            'border-radius': '5px',
                            '-moz-border-radius': '5px',
                            '-webkit-border-radius': '5px',
                            padding: '10px'
                        });
                        backupPosition(link.href, position);
                        displayPositionChange(link);
                        break;
                    }
                }
            }
            continue;
        }
        
        link = lis[i].getElement('a');
        if (link) {
            position = getPosition(link);
            if (storage.datas.position < position && link.href.match(reg)) {
            	storage.datas.found = true;
            	storage.datas.position = position;
                lis[i].setStyles({
                    border: '1px solid #FF0000',
                    'border-radius': '5px',
                    '-moz-border-radius': '5px',
                    '-webkit-border-radius': '5px',
                    padding: '10px'
                });
                backupPosition(link.href, position);
                displayPositionChange(link);
                break;
            }
        }
    }
    storage.save();
    
    document.id('position-google-next-button').setStyle('display', 'inline');
    
    if (storage.datas.found) {
        alert("Trouvé !! Position : "+storage.datas.position);
        storage.datas.onprogress = false;
        storage.save();
    } else if (storage.datas.currentPage < storage.datas.maxPages) { // page suivante
        var pn = document.id('pnnext');
        if (pn) {
        	storage.datas.currentPage += 1;
        	storage.datas.onprogress = true;
            storage.save();
            document.location.href = pn.href;
        } else {
            alert("Désolé, votre adresse est introuvable.");
        }
    } else if (window.confirm("Désolé, votre adresse est introuvable. Chercher plus loin ?")) {
    	storage.datas.maxPages += 10;
        storage.save();
        var pn = document.id('pnnext');
        if (pn) {
        	storage.datas.currentPage += 1;
        	storage.datas.onprogress = true;
            storage.save();
            document.location.href = pn.href;
        } else {
            alert("Désolé, votre adresse est introuvable.");
        }
    }
};


var searchSiteFromKeyword = function(keyword, site) {
	
	if (site) {
		storage.datas.address = site;
		storage.datas.currentPage = 1;
		storage.datas.maxPages = 10;
		storage.datas.position = 0;
		storage.datas.onprogress = true;
		storage.datas.found = false;
		storage.save();
	}

	var el = document.getElement('input[name=q]');
	if (el) {
		el.set('value', keyword).getParent('form').submit();
	} else {
		document.location.href = '/search?q=' + keyword;
	}
};


var renderMenu = function (parent) {
    if (document.id('positionGoogleTab')) {
    	return;
    }
    var ol = document.id('gbg').getElement('ol.gbtc');
    var separator = new Element('li', {'class': 'gbt gbtb'})
        .set('html', '<span class="gbts"></span>');
    separator.inject(ol, 'top');
    var tab = new Element('li', {id: 'positionGoogleTab', 'class': 'gbt'}).adopt(
        new Element('a', {href: '#', 'class': 'gbgt'}).set('html',
            '<span class="gbtb2"></span><span class="gbts"><span style="font-weight: bold;">GooglePosition</span></span>'
        )
    );
    
    var menu = new Element('div').addClass('gbm').set('html',
        '<div class="gbmc"><ol class="gbmcc">\
            <li id="menu-google-position-options" class="gbkc gbmtc"><a href="#" class="gbmt">Paramètrer l\'extension</a></li>\
            <li id="menu-google-position-history" class="gbkc gbmtc"><a href="#" class="gbmt">Voir l\'historique</a></li>\
            <li id="menu-google-position-export" class="gbkc gbmtc"><a href="#" class="gbmt">Exporter les données</a></li>\
            <li id="menu-google-position-import" class="gbkc gbmtc"><a href="#" class="gbmt">Importer les données</a></li>\
            <li id="menu-google-position-erase" class="gbkc gbmtc"><a href="#" class="gbmt">Effacer les données</a></li>\
    		<li id="menu-google-position-about" class="gbkc gbmtc"><a href="#" class="gbmt">À propos</a></li>\
        </ol></div>'
    ).inject(tab, 'bottom');
    
    tab.inject(ol, 'top').addEvent('click', function (e) {
        e.stop();
        this.toggleClass('gbto');
        menu.setStyle('display', this.hasClass('gbto')?'block':'none');
    });
    
    document.id('menu-google-position-options').addEvent('click', function () {
    	boxOptions.render().open();
    });
    document.id('menu-google-position-history').addEvent('click', function () {
    	boxHistory.render().open();
    });
    document.id('menu-google-position-import').addEvent('click', function () {
    	boxImport.render().open();
    });
    document.id('menu-google-position-export').addEvent('click', function () {
    	boxExport.render().open();
    });
    document.id('menu-google-position-erase').addEvent('click', function () {
        if (!window.confirm('Effacer toutes les données liées à l\extension ?')) {
            return;
        }
        storage.history = storage.options = storage.datas = {};
        storage.save();
    });
    document.id('menu-google-position-about').addEvent('click', function () {
    	boxAbout.render().open();
    });
};

var boxAbout;
var boxImport;
var boxExport;
var boxHistory;
var boxOptions;


var init = function () {
	if (!boxAbout) {
		boxAbout = new BoxAbout();
	}
	if (!boxImport) {
		boxImport = new BoxImport();
	}
	if (!boxExport) {
		boxExport = new BoxExport();
	}
	if (!boxHistory) {
		boxHistory = new BoxHistory();
	}
	if (!boxOptions) {
		boxOptions = new BoxOptions();
	}
    

	renderMenu();
    
    
    if (!document.id('search')) {
        return false;
    }
    if (document.id('google-search-position')) {
        return true;
    }
    
    
    // Highlight les sites
    if (storage.getOption('highlightSites')) {
    	highlightSites(storage.getOption('highlightSites'));
    }
    
    var form = new Element('form', {
        action: '', method: 'post'
    });
    var container = new Element('div', {
        id: 'google-search-position',
        styles: {margin: '0 0 10px 0'}
    });
    form.adopt(container).inject(document.id('search'), 'top');
    
    container.adopt(
        new Element('label', {
            text: 'Adresse à rechercher : ', 'form': 'positionGoogleUrl',
            styles: {display: 'block'}
        }),
        new Element('input', {
            type: 'text', id: 'positionGoogleUrl', name: 'positionGoogleUrl',
            value: storage.datas.address?storage.datas.address:'', size: 50,
            title: 'Adresse du site ou de la page recherché.'
        }),
        new Element('input', {
            type: 'submit', id: 'positionGoogleUrl', value: 'Rechercher',
            title: 'Lancer la recherche.'
        }),
        new Element('input', {
            type: 'button', id: 'position-google-next-button',
            value: 'Continuer la recherche', title: 'Continuer la recherche.',
            styles: {display: 'none'}
        }),
        new Element('input', {
            type: 'button', id: 'position-google-erase-button',
            value: 'Effacer', title: 'Effacer le contenu du champ.',
            styles: {display: 'none'}
        })
    );
    
    
    form.addEvent('submit', function (event) {
        event.stop();
        
        var address = document.id('positionGoogleUrl').get('value');
        if (!address.test(/^https?:\/\//)) {
        	address = 'http://' + document.id('positionGoogleUrl').get('value');
        	document.id('positionGoogleUrl').set('value', address);
        }
        
        storage.datas.address = address;
        storage.datas.currentPage = 1;
        storage.datas.maxPages = 10;
        storage.datas.position = 0;
        storage.datas.onprogress = false;
        storage.datas.found = false;
        storage.save();
        if (getCurrentPage() != 1) {
        	storage.datas.onprogress = true;
            storage.save();
            document.location.href = document.location.href.replace(/start=[0-9]+/, 'start=0');
        } else {
            searchAddress();
        }
    });

    document.id('position-google-next-button').addEvent('click', function (event) {
    	storage.datas.maxPages = getCurrentPage() + 10;
    	storage.datas.found = false;
        storage.save();
        searchAddress();
    });
    
    if (storage.datas.onprogress) {
    	storage.datas.onprogress = false;
        storage.save();
        searchAddress();
    }
    
    return true;
};


var timer;
var check = function () {
    var menu = document.id('gb_1');
    if (menu && menu.hasClass('gbz0l')) {
		if (storage.getOption('displayPosition')) {
			displayPosition();
		}
		init();
    }
    
    timer = setTimeout(check, 500);
};












/* 
 * Création des classes
 */

/**
 * Classe pour afficher des boites
 */
var Box = new Class({
	
	Implements: [Events, Options],
	
	opened: false,
	rendered: false,
	element: null,
	
	options: {
		unique: true,
		center: {
			vertical: true, horizontal: true
		},
		styles: {
            position: 'absolute', top: '50%', left: '50%',
            margin: '-100px 0 0 -200px',
            width: 400,
            padding: 5,
            'padding-left': 33,
            'border-radius': '7px',
            '-moz-border-radius': '7px',
            '-webkit-border-radius': '7px',
            border: '2px solid #AAA',
            'font-size': 11,
            background: '#FFF',
            'box-shadow': '0 0 30px #999',
            '-moz-box-shadow': '0 0 30px #999',
            '-webkit-box-shadow': '0 0 30px #999',
            'z-index': 9999,
            'display': 'none'
        }
	},
	
	initialize : function () {
		
	},
	
	open: function () {
		if (this.options.unique) {
			var all = document.getElements('div.gpBoxContainer');
			all.each(function (container) {
				var box = container.retrieve('box');
				if (box) {
					box.close();
				}
			});
		}
		
		this.getElement().setStyles({
			display: 'block', opacity: 0,
			
			// default position
			top: 0, left: 0
		});
		
		if (this.options.center.horizontal) {
			this.getElement().setStyles({
				left: '50%',
				'margin-left': -1 * this.getElement().getSize().x / 2
			});
		}
		if (this.options.center.vertical) {
			this.getElement().setStyles({
				top: '50%',
				'margin-top': -1 * this.getElement().getSize().y / 2
			});
		}
		
		this.getElement().setStyle('opacity', 1);
		this.opened = true;
	},
	
	close: function () {
		this.getElement().setStyles({
			display: 'none'
		});
		this.opened = false;
	},
	
	isOpen: function () {
		return this.opened;
	},
	
	/**
	 * Set styles of box container
	 * @return Box
	 */
	setStyles: function (newStyles) {
		this.setOptions({styles: $merge(this.options.styles, newStyles)});
		if (this.rendered) {
			this.getElement().setStyles(this.options.styles);
		}
	},
	
	getStyles: function () {
		return this.options.styles;
	},
	
	
	getElement : function () {
		if (!this.element) {
			this.element = new Element('div', {
	            styles: this.getStyles(),
	            'class': 'gpBoxContainer'
	        });
			
			// associe la box à l'élément HTML
			this.element.store('box', this);
			
			this.element.inject(document.body, 'top');
		}
		return this.element;
	},
	
	
	/**
	 * @return Box
	 */
	render: function () {
		
		// éléments destinés à la fermeture de la box
        this.getElement().getElements('.closeBox').addEvent('click', function (e) {
        	e.stop();
        	this.close();
        }.bind(this));
		
		this.rendered = true;
		return this;
	}
	
});


/**
 * Ferme toutes les box lors d'un clic ailleur
 */
document.getElement('body').addEvent('click', function (e) {
    if (e && !$(e.target).hasClass('gpBoxContainer') && !$(e.target).getParent('div.gpBoxContainer')) {
    	var all = document.getElements('div.gpBoxContainer');
    	all.each(function (container) {
    		var box = container.retrieve('box');
    		if (box) {
    			box.close();
    		}
    	});
    }
});


/**
 * Box « About »
 */
var BoxAbout = new Class({
	
	Extends: Box,
	
	render: function () {
		if (this.rendered) {
			return this;
		}
		
		this.getElement().set('html',
			'<h2>À propos de GPosition - v'+version+'</h2>' +
	        '<p style="font-size: 14px; line-height: 16px;">' +
	        '	<img src="http://1.gravatar.com/avatar/774d9ade2d54af8618e03d036d2e86bf?s=50&r=G" alt="" style="float: left; display: block; margin: 0 5px 5px 0;" />' +
	        '	Blount - <a href="mailto:blount@ilatumi.org">blount@ilatumi.org</a><br />' +
	        '	Site - <a href="http://programmation-web.net" target="_blank">http://programmation-web.net</a><br />' +
	        '	<a href="http://programmation-web.net/gposition-aide-a-la-seo" target="_blank">Page de l\'extension</a>' +
	        '	| <a href="http://programmation-web.net/gposition-dernier-changement/" target="_blank">Derniers changements</a><br />' +
	        '</p>' +
	        '<form action="" method="post">\
	            <div>\
	                <div class="lsbb" style="float: left; clear: both;"><input type="button" value="Fermer" class="lsb closeBox" /></div>\
	            </div>\
	        </form>'
	    );
		
		this.parent();
		return this;
	}
	
});


/**
 * Box « Options »
 */
var BoxOptions = new Class({
	
	Extends: Box,
	
	open: function () {
	    document.id('positionGoogleOptionsDisplayPosition'+(storage.getOption('displayPosition')?1:0)).checked = true;
	    document.id('positionGoogleOptionsStorePosition'+(storage.getOption('backupPosition')?1:0)).checked = true;
	    if (storage.getOption('highlightSites').join) {
	        document.id('positionGoogleOptionsHighlightSite').set('value', storage.getOption('highlightSites').join("\n"));
	    }
		
		return this.parent();
	},
	
	render: function () {
		if (this.rendered) {
			return this;
		}
		
		this.getElement().set('html',
            '<h2>Configuration de l\'extension GooglePosition</h2>' +
            '<form action="" method="post">\
                <dl>\
                    <dt><label>Afficher la position des sites :</label></dt>\
                    <dd id="positionGoogleOptionsDisplayPosition">\
                        <input type="radio" value="1" name="positionGoogleOptionsDisplayPosition" id="positionGoogleOptionsDisplayPosition1" checked="checked" />\
                        <label for="positionGoogleOptionsDisplayPosition1">Oui</label>\
                        <input type="radio" value="0" name="positionGoogleOptionsDisplayPosition" id="positionGoogleOptionsDisplayPosition0" />\
                        <label for="positionGoogleOptionsDisplayPosition0">Non</label>\
                    </dd>\
                    <dt><label>Garder en mémoire la position des sites recherchés :</label></dt>\
                    <dd id="positionGoogleOptionsStorePosition">\
                        <input type="radio" value="1" name="positionGoogleOptionsStorePosition" id="positionGoogleOptionsStorePosition1" checked="checked" />\
                        <label for="positionGoogleOptionsStorePosition1">Oui</label>\
                        <input type="radio" value="0" name="positionGoogleOptionsStorePosition" id="positionGoogleOptionsStorePosition0" />\
                        <label for="positionGoogleOptionsStorePosition0">Non</label>\
                    </dd>\
		            <dt>\
            			<label for="positionGoogleOptionsHighlightSite">Mettre en surbrillance les sites suivants :<br />\
            			(une URL par ligne, et avec les http (ou https) s\'il vous plait):</label>\
            		</dt>\
		            <dd>\
		            	<textarea id="positionGoogleOptionsHighlightSite" name="positionGoogleOptionsHighlightSite" cols="70" rows="6" style="width: 80%;"></textarea>\
		            </dd>\
                    <dt></dt>\
                    <dd style="margin-top: 10px;">\
                        <div class="lsbb" style="float: left;"><input type="submit" value="Sauvegarder" class="lsb" /></div>\
                        <div class="lsbb" style="float: left; margin-left: 10px;"><input type="button" value="Fermer" class="lsb closeBox" /></div>\
                    </dd>\
                </dl>\
            </form>'
	    );
        
		this.getElement().getElement('form').addEvent('submit', function (event) {
            event.stop();
            
            storage.setOption('displayPosition', document.id('positionGoogleOptionsDisplayPosition0').checked?false:true);
            storage.setOption('backupPosition', document.id('positionGoogleOptionsStorePosition0').checked?false:true);
            
            if (!storage.getOption('displayPosition')) {
                var positions = document.getElements('span.spanPositionGoogle');
                if (positions.length > 0) {
                    positions.destroy();
                }
            }
            var sites = [];
            document.id('positionGoogleOptionsHighlightSite').get('value').split("\n").each(function (site) {
            	site = site.trim();
            	if (site.match(/^https?:\/\//)) {
                    sites.push(site);
            	}
            });
            storage.setOption('highlightSites', sites);
            highlightSites(storage.getOption('highlightSites'));

            storage.save();
            this.close();
        }.bind(this));
		
		this.parent();
		return this;
	}
	
});


/**
 * Box « Export »
 */
var BoxExport = new Class({
	
	Extends: Box,
	
	open: function () {
	    document.id('positionGoogleExport').set('value', storage.toJsonString());
	    
	    return this.parent();
	},
	
	render: function () {
		if (this.rendered) {
			return this;
		}
		
		this.getElement().set('html',
            '<h2>Exportation des données de cet ordinateur</h2>' +
            '<p>Vous pouvez enregistrer cette chaîne de caractères dans un fichier afin de sauvegarder vos informations.</p>' +
            '<form action="" method="post">\
                <p><label>Exportation :</label></p>\
                <p><textarea id="positionGoogleExport" cols="50" rows="3" style="width: 100%;"></textarea></p>\
                <p><div class="lsbb" style="display: inline-block"><input type="button" value="Fermer" class="lsb closeBox" /></div></p>\
            </form>'
        );
		
		this.parent();
		return this;
	}
	
});


/**
 * Box « Import »
 */
var BoxImport = new Class({
	
	Extends: Box,
	
	render: function () {
		if (this.rendered) {
			return this;
		}
		
		this.getElement().set('html',
            '<h2>Importations des données sur cet ordinateur</h2>' +
            '<p>Vous pouvez importer ici une chaîne de caractères précédemment exportée.</p>' +
            '<form action="" method="post">\
                <p><label>Importation :</label></p>\
                <p><textarea id="positionGoogleImport" cols="50" rows="3" style="width: 100%;"></textarea></p>\
                <div>\
                    <div class="lsbb" style="float: left;"><input type="submit" value="Importer" class="lsb" /></div>\
                    <div class="lsbb" style="float: left; margin-left: 10px;"><input type="button" value="Fermer" class="lsb closeBox" /></div>\
                </div>\
            </form>'
        );
		
		// apture l'envoi du formulaire
		this.getElement().getElement('form').addEvent('submit', function (e) {
            e.stop();
            var value = document.id('positionGoogleImport').get('value');
            if (value && window.confirm('Terminer l\'importation des données ? (écrase les données existantes)')) {
                storage.import(value);
                this.close();
                alert('Données importées.');
            }
        }.bind(this));
		
		this.parent();
		return this;
	}
	
});


/**
 * Box « History »
 */
var BoxHistory = new Class({
	
	Extends: Box,
	
	initialize: function () {
		this.setStyles({
			width: 600, height: 400,
			overflow: 'auto'
		});
		
		this.parent();
	},
	
	render: function () {
		this.getElement().set('html',
            '<h2>Historique enregistré</h2>' +
            '<div class="content"></div>' +
            '<div class="lsbb" style="float: left;"><input type="button" value="Fermer" class="lsb closeBox" /></div>'
        );
	    
	    var content = this.getElement().getElement('div.content').empty();
	    var date = new Date();
	    
	    $each(storage.history, function (sites, keyword) {
	        var title = new Element('h3', {text: keyword})
				.adopt(new Element('img', {
						src: 'http://ilatumi.org/positiongoogle/search.png',
						alt: 'rechercher',
						title: 'Lancer la recherche sur « '+keyword+' »',
						styles: {margin: '0 0 0 5px', 'vertical-align': 'middle', cursor: 'pointer'}
					}).addEvent('click', function (e) {
						searchSiteFromKeyword(keyword);
					}));
	        var table = new Element('table').setStyles({
	            border: '1px solid #DDD', 'margin': '10px 0',
	            'border-collapse': 'collapse',
	            width: '100%', 'text-align': 'center'
	        }).adopt(
	            new Element('thead').adopt(
	                new Element('th', {text: 'Lien'}),
	                new Element('th', {text: 'Dernière position', styles: {width: 100}}),
	                new Element('th', {text: 'Quand ?', styles: {width: 100}}),
	                new Element('th', {styles: {width: 25}}),
	                new Element('th', {styles: {width: 25}})
	            ),
	            new Element('tbody')
	        );
	        var body = table.getElement('tbody');
	        
	        var dateStr;
	        for (var i = 0; i < sites.length; i++) {
	            date.setTime(sites[i][1].getLast().time);
	            dateStr = "";
	            if (date.getDate() < 10) {
	                dateStr += "0" + date.getDate();
	            } else {
	                dateStr += date.getDate();
	            }
	            dateStr += " / ";
	            if (date.getMonth() < 9) {
	                dateStr += "0" + (date.getMonth() + 1);
	            } else {
	                dateStr += date.getMonth();
	            }
	            dateStr += " / "+date.getFullYear();
	            
	            body.adopt(new Element('tr').adopt(
	                new Element('td', {text: sites[i][0]}),
	                new Element('td', {text: sites[i][1].getLast().position}),
	                new Element('td', {text: dateStr}),
	                new Element('td', {html: '<a href="#"><img src="http://ilatumi.org/positiongoogle/delete.png" '+
							'alt="supprimer" title="Supprimer cette entrée ?" /></a>', 'class': 'delete'})
	                    .addEvent('click', function (e) {
	                        e.stop();
	            	        if (storage.historyEraseUrl(keyword, this.getParent('tr').getElement('td').get('text')) && boxHistory.isOpen()) {
	            	        	boxHistory.render();
	            	        }
	                    }),
	                new Element('td', {html: '<a href="#"><img src="http://ilatumi.org/positiongoogle/search.png" '+
							'alt="rechercher" title="Rechercher à nouveau ce site avec le mot clé « '+keyword+' »" /></a>', 'class': 'search'})
	                    .addEvent('click', function (e) {
	                        e.stop();
	                        searchSiteFromKeyword(keyword, this.getParent('tr').getElement('td').get('text'));
	                    })
	            ));
	        }
	        
	        table.getElements('td').setStyle('border-top', '1px solid #DDD');
	        
	        content.adopt(title, table);
	    });
	    
	    if (content.get('html') == '') {
	        content.adopt(new Element('p', {
	            text: 'L\'historique est vide.'
	        }));
	    }
		
		this.parent();
		return this;
	}
	
});























check();

