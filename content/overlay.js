var TMPentries = {'proxies':[]};
var {interfaces: Ci, utils: Cu,    classes: Cc} = Components;
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");

var proxyFile = FileUtils.getFile('ProfD', ['RoscomProxy_proxyFile.txt']);
var bannedSites = FileUtils.getFile('ProfD', ['RoscomProxy_bannedSites.txt']);
var usr_bannedSites = FileUtils.getFile('ProfD', ['RoscomProxy_usr_bannedSites.txt']);
var usr_proxies = FileUtils.getFile('ProfD', ['RoscomProxy_usr_proxies.txt']);

function randomIntFromInterval(min,max)
{
    return Math.floor(Math.random()*(max-min+1)+min);
}
function writeFile(nsiFile, data, overwrite, callback) {
    //overwrite is true false, if false then it appends
    //nsiFile must be nsiFile
    if (!(nsiFile instanceof Ci.nsIFile)) {
        Cu.reportError('ERROR: must supply nsIFile ie: "FileUtils.getFile(\'Desk\', [\'rawr.txt\']" OR "FileUtils.File(\'C:\\\\\')"');
        return;
    }
    if (overwrite) {
        var openFlags = FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_TRUNCATE;
    } else {
        var openFlags = FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_APPEND;
    }
    //data is data you want to write to file
    //if file doesnt exist it is created
    var ostream = FileUtils.openFileOutputStream(nsiFile, openFlags)
    var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter'].createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = 'UTF-8';
    var istream = converter.convertToInputStream(data);
    // The last argument (the callback) is optional.
    NetUtil.asyncCopy(istream, ostream, function (status) {
        if (!Components.isSuccessCode(status)) {
            // Handle error!
            Cu.reportError('error on write isSuccessCode = ' + status);
            callback(status);
            return;
        }
        // Data has been written to the file.
        callback(status)
    });
}
function readFile(file, callback) {
    //file does not have to be nsIFile
    //you must pass a callback like function(dataReadFromFile, status) { }
    //then within the callback you can work with the contents of the file, it is held in dataReadFromFile
    //callback gets passed the data as string
    NetUtil.asyncFetch(file, function (inputStream, status) {
        //this function is callback that runs on completion of data reading
        if (!Components.isSuccessCode(status)) {
            Cu.reportError('error on file read isSuccessCode = ' + status);
            callback(null, status)
            return;
        }
        var data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
        callback(data, status);
    });
}
function popup(title, text) {
  try {
    Components.classes['@mozilla.org/alerts-service;1'].
              getService(Components.interfaces.nsIAlertsService).
              showAlertNotification(null, title, text, false, '', null);
  } catch(e) {
    // prevents runtime error on platforms that don't implement nsIAlertsService
  }
}

function updProxies(callback) {
    let proxies = "http://letushide.com/fpapi/?key=be630f035480a894ad2898f8&as=ap,dp,hap&ps=http,https&cs=us,ca,eu,fr,fi,ch,se,gb";
    let request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
              .createInstance(Components.interfaces.nsIXMLHttpRequest);
    request.open("GET", proxies, true);
    request.send(null);

    request.onload = function(aEvent) {
        let text = aEvent.target.responseText;
        alert(text);
        Application.console.log(text);
        writeFile(proxyFile, text, true, function (status) {});
        callback(text);
    };
}

var getRndProxy = function getRndProxy(downloadAgain=0, callback) {
    readFile(proxyFile, function (dataReadFromFile, status) {
        if (!Components.isSuccessCode(status) || downloadAgain==1) {
            updProxies(function(text) {
                return callback(text);
            });
        } else {
            return callback(dataReadFromFile);
        }
    });
}

function unregisterLastProxy(TheProxy,url) {
    var pps = Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
              .getService(Components.interfaces.nsIProtocolProxyService);

    // Create the proxy info object in advance to avoid creating one every time
    var myProxyInfo = pps.newProxyInfo(TheProxy.protocol, TheProxy.host, TheProxy.port, 0, -1, null);
    var filter = {
      applyFilter: function(pps, uri, proxy)
        {
            if (uri.spec == url)
              return myProxyInfo;
            else
              return proxy;
        }
    };
    pps.unregisterFilter(filter);
}

function prepareProxies(url,reset=0) {
    gBrowser.stop();
    url = url.toString();

    var usr_proxies_exist = 0;
    readFile(usr_proxies, function (dataReadFromFile, status) {
        if (!Components.isSuccessCode(status)) {
        } else {
            if(dataReadFromFile!='' && dataReadFromFile!=undefined && dataReadFromFile!='[]') {
                var json_usrProxies = JSON.parse(dataReadFromFile);
                if(json_usrProxies.length>1){
                    var rnd = randomIntFromInterval(0,json_usrProxies.length-1);
                }else{
                    var rnd = 0;
                }
                var TheProxy = json_usrProxies[rnd];
                usr_proxies_exist=1;
                SetProxy(TheProxy,url);
            }
        }
        if(usr_proxies_exist==0) {
            getRndProxy(reset,function(list) {
                var ProxyList = JSON.parse(list);
                var rnd = randomIntFromInterval(0,ProxyList.count);
                var TheProxy = ProxyList.data[rnd];
                SetProxy(TheProxy,url);
            });
        }
    });
}

function SetProxy(TheProxy,url) {
    var pps = Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
              .getService(Components.interfaces.nsIProtocolProxyService);

    // Create the proxy info object in advance to avoid creating one every time
    var myProxyInfo = pps.newProxyInfo(TheProxy.protocol, TheProxy.host, TheProxy.port, 0, -1, null);

    
    var filter = {
      applyFilter: function(pps, uri, proxy)
        {
            var burl = uri.spec;
            var tburl = burl.substring(0, burl.length - 1);
            var turl = url.substring(0, url.length - 1);
            if(turl.length<tburl.length && tburl.substring(0, turl.length) == turl) {
                return myProxyInfo;
            }else if(turl.substring(0, tburl.length) == tburl){
                return myProxyInfo;
            }else{
                return proxy;
            }
        }
    };
    var found = checkIfAlreadyProxied(url);
    if(found==0) {
        pps.registerFilter(filter,1000);
        popup('New Proxy for this site!',url+' now see your IP as '+TheProxy.host+':'+TheProxy.port);
        TMPentries.proxies.push({'proxy':TheProxy,'url':url});
        Application.console.log(JSON.stringify(TMPentries));
        document.getElementById('reloadButton').setAttribute('label',TheProxy.host+':'+TheProxy.port);
        gBrowser.reload();
    }
}

function updWebsites(callback) {
    let banned = "http://api.antizapret.info/all.php?type=json";
    let request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
              .createInstance(Components.interfaces.nsIXMLHttpRequest);
    request.open("GET", banned, true);
    request.send(null);

    request.onload = function(aEvent) {
        let text = aEvent.target.responseText;
        writeFile(bannedSites, text, true, function (status) {});
        return callback(text);
    };
}

var getWebsiteList = function getWebsiteList(downloadAgain=0, callback) {
    readFile(bannedSites, function (dataReadFromFile, status) {
        if (!Components.isSuccessCode(status) || downloadAgain==1) {
            updWebsites(function(text){
                return text;
            });
        } else {
            return callback(dataReadFromFile);
        }
    });
}

var getUSRWebsiteList = function getWebsiteList(callback) {
    readFile(usr_bannedSites, function (dataReadFromFile, status) {
        return callback(dataReadFromFile);
    });
}

function checkIfAlreadyProxied(url,returnProxy) {
    var found = 0;
    var index;
    var TheProxy = 0;
    for (index = 0; index < TMPentries.proxies.length; ++index) {
        var proxied_url = TMPentries.proxies[index].url;
        if(url.length<proxied_url.length && proxied_url.substring(0, url.length) == url) {
            found = 1;
            TheProxy = TMPentries.proxies[index];
            break;
        }else if(url.substring(0, proxied_url.length) == proxied_url){
            found = 1;
            TheProxy = TMPentries.proxies[index];
            break;
        }
    }
    if(returnProxy==undefined || returnProxy==0) {
        return found;
    }else{
        return TheProxy;
    }
}

function checkIfBanned(url,reset) {
    url = url.toString();
    var found = checkIfAlreadyProxied(url);
    if(found==0) {
        getWebsiteList(reset,function(list) {
            var jsonBannedSites = JSON.parse(list);
            jsonBannedSites = jsonBannedSites.register;
            var index;
            for (index = 0; index < jsonBannedSites.length; ++index) {
                var burl = jsonBannedSites[index].url;
                var tburl = burl.substring(0, burl.length - 1);
                if(url.substring(0, tburl.length) == tburl) {
                    prepareProxies(url);
                }
            }
        });
        getUSRWebsiteList(function(list) {
            var jsonBannedSites = JSON.parse(list);
            var index;
            for (index = 0; index < jsonBannedSites.length; ++index) {
                var burl = jsonBannedSites[index];
                var tburl = burl.substring(0, burl.length - 1);
                if(url.substring(0, tburl.length) == tburl) {
                    prepareProxies(url);
                }
            }
        });
    }
}

function resetProxy() {
    var curUrl = getCurrentURL();
    var index;
    for (index = 0; index < TMPentries.proxies.length; ++index) {
        var proxied_url = TMPentries.proxies[index].url;
        
        if(proxied_url.substring(0, curUrl.length) == curUrl) {
            unregisterLastProxy(TMPentries.proxies[index].proxy,TMPentries.proxies[index].url);
            TMPentries.proxies.splice(index, 1);
        }
    }
    prepareProxies(curUrl);
}

function examplePageLoad(event) {
    var curUrl = getCurrentURL();
    checkIfBanned(curUrl);
}

function getCurrentURL() {
    var curUrl = window.content.document.location;
    curUrl = curUrl.toString();
    var pattern = /(http[s]?:\/\/.*?\..*?)\//;
    Application.console.log(curUrl);
    var validURL = curUrl.match(pattern);
    Application.console.log(validURL[1]);
    return validURL[1];
}

window.addEventListener("load", function () {
    gBrowser.addEventListener("load", examplePageLoad, true);
}, false);

function openMenu() {
    var w = 300;
    var h = 100;
    var left = (screen.width/2)-(w/2);
    var top = (screen.height/2)-(h/2);
    window.open("chrome://roscomproxy/content/hello.xul", "", "chrome,centerscreen");
}
function redownloadProxies() {
    updProxies(function(){alert('Done');});
}

function redownloadSites() {
    updWebsites(function(){alert('Done');});
}

function exampleTabSelected(event) {
    var browser = gBrowser.selectedBrowser;
    var curUrl = getCurrentURL();
    var TheProxy = checkIfAlreadyProxied(curUrl,1);
    if(TheProxy!=0) {
        TheProxy = TheProxy.proxy;
        document.getElementById('reloadButton').setAttribute('label',TheProxy.host+':'+TheProxy.port);
    }else{
        document.getElementById('reloadButton').setAttribute('label',"Your IP isn't changed");
    }
}

// During initialisation
var container = gBrowser.tabContainer;
container.addEventListener("TabSelect", exampleTabSelected, false);