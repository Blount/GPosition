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
 * Protège les caractères spéciaux des RegExp d'une chaîne.
 * @return string
 */
var preg_quote = function (str, delimiter) {
    return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&');
};

var options = {
    displayPosition: true,
    backupPosition: true,
    highlightSites: []
};

var datas = {
    onprogress: false,
    found: false,
    address: null,
    position: 0,
    currentPage: 1,
    maxPages: 10,
    version: 2
};

var historyPosition = {
    
};

var loadDatas = function() {
    try {
        var d = JSON.parse(localStorage.getItem('googlePosition'));
        var h = JSON.parse(localStorage.getItem('googlePositionHistory'));
        var o = JSON.parse(localStorage.getItem('googlePositionOptions'));
    } catch(e) {
        return;
    }
    if (d) {
        if (!d.version || d.version != datas.version) {
            d = datas;
        }
        datas = $merge(datas, d);
    }
    if (h) {
        historyPosition = $merge(historyPosition, h);
    }
    if (o) {
        options = $merge(options, o);
    }
};
loadDatas();

var saveDatas = function () {
    localStorage.setItem('googlePosition', JSON.stringify(datas));
    localStorage.setItem('googlePositionHistory', JSON.stringify(historyPosition));
    localStorage.setItem('googlePositionOptions', JSON.stringify(options));
};

var exportDatas = function () {
    saveDatas();
    
    return JSON.stringify({
        position: datas, history: historyPosition, options: options
    });
};
var importDatas = function (string) {
    var e = JSON.parse(string);
    if (e) {
        if (e.position) {
            position = e.position;
        }
        if (e.history) {
            historyPosition = e.history;
        }
        if (e.options) {
            options = e.options;
        }
    }
    saveDatas();
};


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
    if (!search || !options.displayPosition) {
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
    if (!options.backupPosition) {
        return;
    }
    
    var search = getSearchKeywords();
    if (!historyPosition[search]) {
        historyPosition[search] = [];
    }
    
    for (var i = 0; i < historyPosition[search].length; i++) {
        if (historyPosition[search][i][0] == url) {
            historyPosition[search][i][1].push({'time': new Date().getTime(), 'position': position});
            saveDatas();
            return;
        }
    }
    
    var newEntry = [url, [{'time': new Date().getTime(), 'position': position}]];
    historyPosition[search].push(newEntry);
    saveDatas();
};


/**
 * Affiche l'évolution de position d'un site
 */
var displayPositionChange = function (a) {
    if (!options.backupPosition) {
        return;
    }
    var search = getSearchKeywords();
    if (!historyPosition[search]) {
        return;
    }
    for (var i = 0; i < historyPosition[search].length; i++) {
        if (historyPosition[search][i][0] == a.get('href')) {
            var positions = historyPosition[search][i][1];
            if (positions.length > 1) {
                var evolution = positions[positions.length-2].position.toInt() - positions[positions.length-1].position.toInt();
                var color = '#FFB900';
                var bColor = '#DDD';
                var bgColor = '#F0F0F0';
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
            }
            break;
        }
    }
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
    var reg = new RegExp("^"+preg_quote(datas.address)+".*");
    for (var i = 0; i < lis.length; i++) {
        // box lié à Google Map
        if (lis[i].id == 'lclbox') {
            var h4s = lis[i].getElements('h4');
            for (var j = 0; j < h4s.length; j++) {
                link = h4s[j].getElement('a');

                if (link) {
                    position = getPosition(link);
                    if (datas.position < position && link.href.match(reg)) {
                        datas.found = true;
                        datas.position = position;
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
            if (datas.position < position && link.href.match(reg)) {
                datas.found = true;
                datas.position = position;
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
    saveDatas();
    
    document.id('position-google-next-button').setStyle('display', 'inline');
    
    if (datas.found) {
        alert("Trouvé !! Position : "+datas.position);
        datas.onprogress = false;
        saveDatas();
    } else if (datas.currentPage < datas.maxPages) { // page suivante
        var pn = document.id('pnnext');
        if (pn) {
            datas.currentPage += 1;
            datas.onprogress = true;
            saveDatas();
            document.location.href = pn.href;
        } else {
            alert("Désolé, votre adresse est introuvable.");
        }
    } else if (window.confirm("Désolé, votre adresse est introuvable. Chercher plus loin ?")) {
        datas.maxPages += 10;
        saveDatas();
        var pn = document.id('pnnext');
        if (pn) {
            datas.currentPage += 1;
            datas.onprogress = true;
            saveDatas();
            document.location.href = pn.href;
        } else {
            alert("Désolé, votre adresse est introuvable.");
        }
    }
};


/**
 * Ferme toutes les fenêtres
 */
var closeGooglePositionAll = function (e) {
    if (e && ($(e.target).hasClass('positionGoogleContainer') || $(e.target).getParent('div.positionGoogleContainer'))) {
        return;
    }
    closeGooglePositionOptions();
    closeGooglePositionHistory();
    closeGooglePositionExport();
    closeGooglePositionImport();
    closeGooglePositionAbout();
};
$$('body')[0].addEvent('click', closeGooglePositionAll);


/**
 * Fenêtre de l'historique de l'extension
 */
var openGooglePositionHistory = function (event) {
    closeGooglePositionAll();
    
    if (!document.id('positionGoogleHistoryContainer')) {
        var container = new Element('div', {
            id: 'positionGoogleHistoryContainer',
            styles: {
                position: 'absolute', top: 5, left: '50%',
                margin: '20px 0 0 -300px',
                width: 600,
                'max-height': 400,
                overflow: 'auto',
                padding: '5px 33px',
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
            },
            'class': 'positionGoogleContainer'
        }).set('html',
            '<h2>Historique enregistré</h2>' +
            '<div class="content"></div>' +
            '<div class="lsbb" style="float: left;"><input type="button" value="Fermer" class="lsb" /></div>'
        );
        container.inject(document.body, 'top');
        
        container.getElement('input[type=button]').addEvent('click', closeGooglePositionHistory);
    }
    updateGooglePositionHistory();
    
    document.id('positionGoogleHistoryContainer').setStyles({
        display: 'block', opacity: 0
    }).setStyle('opacity', 1);
};
var closeGooglePositionHistory = function () {
    if (document.id('positionGoogleHistoryContainer')) {
        document.id('positionGoogleHistoryContainer').setStyle('display', 'none');
    }
};
var updateGooglePositionHistory = function () {
    if (!document.id('positionGoogleHistoryContainer')) {
        openGooglePositionHistory();
    }
    
    var content = document.id('positionGoogleHistoryContainer')
        .getElement('div.content').empty();
    
    var date = new Date();
    
    $each(historyPosition, function (sites, keyword) {
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
                        deleteSiteFromKeyword(keyword, this.getParent('tr').getElement('td').get('text'));
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
        return;
    }
};
var deleteSiteFromKeyword = function (keyword, site) {
    var newHistory = {};
    $each(historyPosition, function (sites, _keyword) {
        if (keyword != _keyword) {
            newHistory[_keyword] = sites;
            return;
        }
        var h = [];
        for (var i = 0; i < sites.length; i++) {
            if (sites[i][0] != site) {
                h.push(sites[i]);
            }
        }
        if (h.length > 0) {
            newHistory[_keyword] = h;
        }
    });
    historyPosition = newHistory;
    updateGooglePositionHistory();
    saveDatas();
};
var searchSiteFromKeyword = function(keyword, site) {
	
	if (site) {
		datas.address = site;
		datas.currentPage = 1;
		datas.maxPages = 10;
		datas.position = 0;
		datas.onprogress = true;
		datas.found = false;
		saveDatas();
	}

	var el = document.getElement('input[name=q]');
	if (el) {
		el.set('value', keyword).getParent('form').submit();
	} else {
		document.location.href = '/search?q=' + keyword;
	}
};


/**
 * Fenêtre des paramètres de l'extension
 */
var openGooglePositionOptions = function (event) {
    closeGooglePositionAll();
    
    if (!document.id('positionGoogleOptionsContainer')) {
        var container = new Element('div', {
            id: 'positionGoogleOptionsContainer',
            styles: {
                position: 'absolute', top: '50%', left: '50%',
                margin: '-100px 0 0 -300px',
                width: 600,
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
            },
            'class': 'positionGoogleContainer'
        }).set('html',
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
                        <div class="lsbb" style="float: left; margin-left: 10px;"><input type="button" value="Fermer" class="lsb" /></div>\
                    </dd>\
                </dl>\
            </form>'
        );
        container.inject(document.body, 'top');
        
        container.getElement('form').addEvent('submit', function (event) {
            event.stop();
            
            options.displayPosition = document.id('positionGoogleOptionsDisplayPosition0').checked?false:true;
            options.backupPosition = document.id('positionGoogleOptionsStorePosition0').checked?false:true;
            
            if (!options.displayPosition) {
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
            options.highlightSites = sites;
            highlightSites(options.highlightSites);

            saveDatas();
            closeGooglePositionOptions();
        });
        container.getElement('input[type=button]').addEvent('click', closeGooglePositionOptions);
    }
    document.id('positionGoogleOptionsDisplayPosition'+(options.displayPosition?1:0)).checked = true;
    document.id('positionGoogleOptionsStorePosition'+(options.backupPosition?1:0)).checked = true;
    if (options.highlightSites.join) {
        document.id('positionGoogleOptionsHighlightSite').set('value', options.highlightSites.join("\n"));
    }
    
    document.id('positionGoogleOptionsContainer').setStyles({
        display: 'block', opacity: 0
    }).setStyle('opacity', 1);
};
closeGooglePositionOptions = function () {
    if (document.id('positionGoogleOptionsContainer')) {
        document.id('positionGoogleOptionsContainer').setStyle('display', 'none');
    }
};


/**
 * Fenêtre pour export de l'extension
 */
var openGooglePositionExport = function (event) {
    closeGooglePositionAll();
    
    if (!document.id('positionGoogleExportContainer')) {
        var container = new Element('div', {
            id: 'positionGoogleExportContainer',
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
            },
            'class': 'positionGoogleContainer'
        }).set('html',
            '<h2>Exportation des données de cet ordinateur</h2>' +
            '<p>Vous pouvez enregistrer cette chaîne de caractères dans un fichier afin de sauvegarder vos informations.</p>' +
            '<form action="" method="post">\
                <p><label>Exportation :</label></p>\
                <p><textarea id="positionGoogleExport" cols="50" rows="3" style="width: 100%;"></textarea></p>\
                <p><div class="lsbb" style="display: inline-block"><input type="button" value="Fermer" class="lsb" /></div></p>\
            </form>'
        );
        container.inject(document.body, 'top');
        
        container.getElement('input[type=button]').addEvent('click', closeGooglePositionExport);
    }
    
    document.id('positionGoogleExport').set('value', exportDatas());
    
    document.id('positionGoogleExportContainer').setStyles({
        display: 'block', opacity: 0
    }).setStyle('opacity', 1);
};
closeGooglePositionExport = function () {
    if (document.id('positionGoogleExportContainer')) {
        document.id('positionGoogleExportContainer').setStyle('display', 'none');
    }
};


/**
 * Fenêtre pour import de l'extension
 */
var openGooglePositionImport = function (event) {
    closeGooglePositionAll();
    
    if (!document.id('positionGoogleImportContainer')) {
        var container = new Element('div', {
            id: 'positionGoogleImportContainer',
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
            },
            'class': 'positionGoogleContainer'
        }).set('html',
            '<h2>Importations des données sur cet ordinateur</h2>' +
            '<p>Vous pouvez importer ici une chaîne de caractères précédemment exportée.</p>' +
            '<form action="" method="post">\
                <p><label>Importation :</label></p>\
                <p><textarea id="positionGoogleImport" cols="50" rows="3" style="width: 100%;"></textarea></p>\
                <div>\
                    <div class="lsbb" style="float: left;"><input type="submit" value="Importer" class="lsb" /></div>\
                    <div class="lsbb" style="float: left; margin-left: 10px;"><input type="button" value="Fermer" class="lsb" /></div>\
                </div>\
            </form>'
        );
        container.inject(document.body, 'top');
        
        container.getElement('form').addEvent('submit', function (e) {
            e.stop();
            var value = document.id('positionGoogleImport').get('value');
            if (value && window.confirm('Terminer l\'importation des données ? (écrase les données existantes)')) {
                importDatas(value);
                closeGooglePositionImport();
                alert('Données importées.');
            }
        });
        
        container.getElement('input[type=button]').addEvent('click', closeGooglePositionImport);
    }
    document.id('positionGoogleImportContainer').setStyles({
        display: 'block', opacity: 0
    }).setStyle('opacity', 1);
};
closeGooglePositionImport = function () {
    if (document.id('positionGoogleImportContainer')) {
        document.id('positionGoogleImportContainer').setStyle('display', 'none');
    }
};



/**
 * Fenêtre « À propos »
 */
var openGooglePositionAbout = function (event) {
    closeGooglePositionAll();
    
    if (!document.id('positionGoogleAboutContainer')) {
        var container = new Element('div', {
            id: 'positionGoogleAboutContainer',
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
            },
            'class': 'positionGoogleContainer'
        }).set('html',
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
                    <div class="lsbb" style="float: left; clear: both;"><input type="button" value="Fermer" class="lsb" /></div>\
                </div>\
            </form>'
        );
        container.inject(document.body, 'top');
        container.getElement('input[type=button]').addEvent('click', closeGooglePositionAbout);
    }
    document.id('positionGoogleAboutContainer').setStyles({
        display: 'block', opacity: 0
    }).setStyle('opacity', 1);
};
closeGooglePositionAbout = function () {
    if (document.id('positionGoogleAboutContainer')) {
        document.id('positionGoogleAboutContainer').setStyle('display', 'none');
    }
};



var init = function () {
    
    /**
     * Ajoute le menu pour la configuration
     */
    if (!document.id('positionGoogleTab')) {
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
        
        document.id('menu-google-position-options').addEvent('click', openGooglePositionOptions);
        document.id('menu-google-position-history').addEvent('click', openGooglePositionHistory);
        document.id('menu-google-position-import').addEvent('click', openGooglePositionImport);
        document.id('menu-google-position-export').addEvent('click', openGooglePositionExport);
        document.id('menu-google-position-erase').addEvent('click', function () {
            if (!window.confirm('Effacer toutes les données liées à l\extension ?')) {
                return;
            }
            historyPosition = options = datas = {};
            saveDatas();
        });
        document.id('menu-google-position-about').addEvent('click', openGooglePositionAbout);
    }
    
    
    
    if (!document.id('search')) {
        return false;
    }
    if (document.id('google-search-position')) {
        return true;
    }
    
    
    // Highlight les sites
    if (options.highlightSites) {
    	highlightSites(options.highlightSites);
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
            value: datas.address?datas.address:'', size: 50,
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
        
        datas.address = address;
        datas.currentPage = 1;
        datas.maxPages = 10;
        datas.position = 0;
        datas.onprogress = false;
        datas.found = false;
        saveDatas();
        if (getCurrentPage() != 1) {
            datas.onprogress = true;
            saveDatas();
            document.location.href = document.location.href.replace(/start=[0-9]+/, 'start=0');
        } else {
            searchAddress();
        }
    });

    document.id('position-google-next-button').addEvent('click', function (event) {
        datas.maxPages = getCurrentPage() + 10;
        datas.found = false;
        saveDatas();
        searchAddress();
    });
    
    if (datas.onprogress) {
        datas.onprogress = false;
        saveDatas();
        searchAddress();
    }
    
    return true;
};


var timer;
var check = function () {
    var menu = document.id('gb_1');
    if (menu && menu.hasClass('gbz0l')) {
		if (options.displayPosition) {
			displayPosition();
		}
		init();
    }
    
    timer = setTimeout(check, 500);
};
check();

