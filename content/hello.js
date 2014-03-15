var {interfaces: Ci, utils: Cu,    classes: Cc} = Components;
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");

var proxyFile = FileUtils.getFile('ProfD', ['RoscomProxy_proxyFile.txt']);
var bannedSites = FileUtils.getFile('ProfD', ['RoscomProxy_bannedSites.txt']);
var usr_bannedSites = FileUtils.getFile('ProfD', ['RoscomProxy_usr_bannedSites.txt']);
var usr_proxies = FileUtils.getFile('ProfD', ['RoscomProxy_usr_proxies.txt']);

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

function updProxies(callback) {
    let proxies = "http://letushide.com/fpapi/?key=be630f035480a894ad2898f8&as=ap,dp,hap&ps=http,https&cs=us,ca,eu,fr,fi,ch,se,gb";
    let request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
              .createInstance(Components.interfaces.nsIXMLHttpRequest);
    request.open("GET", proxies, true);
    request.send(null);

    request.onload = function(aEvent) {
        let text = aEvent.target.responseText;
        writeFile(proxyFile, text, true, function (status) {});
        callback(text);
    };
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

function redownloadProxies() {
    updProxies(function(){alert('Done');});
}

function redownloadSites() {
    updWebsites(function(){alert('Done');});
}

function saveWebsites(text) {
    text = text.value;
    text = text.toString();
    var arr = text.split('\n');
    var USR_Sites = new Array();
    var index;
    for (index = 0; index < arr.length; ++index) {
        if(arr[index]!='' && arr[index]!=undefined) {
            USR_Sites[index] = arr[index];
        }
    }
    var json_USR_Sites = JSON.stringify(USR_Sites);
    writeFile(usr_bannedSites, json_USR_Sites, true, function (status) {});
}

function saveProxies(text) {
    text = text.value;
    text = text.toString();
    var pattern = /(\d+\.\d+\.\d+\.\d+):(\d+)\|?(https|http)?/;
    var arr = text.split('\n');
    var USR_Proxiesa = new Array();
    var index;
    for (index = 0; index < arr.length; ++index) {
        if(arr[index]!='' && arr[index]!=undefined) {
            var match = arr[index].match(pattern);
            if(match[3]==undefined || match[3]=='') {
                match[3] = 'http';
            }
            USR_Proxiesa[index] = {'host':match[1],'port':match[2],'protocol':match[3]};
        }
    }
    var json_USR_Proxies = JSON.stringify(USR_Proxiesa);
    writeFile(usr_proxies, json_USR_Proxies, true, function (status) {});
}

function loadPrefs() {
    readFile(usr_bannedSites, function (dataReadFromFile, status) {
        var userban = '';
        if (!Components.isSuccessCode(status)) {
        } else {
            var json_usrban = JSON.parse(dataReadFromFile);
            var index;
            for (index = 0; index < json_usrban.length; ++index) {
                if(json_usrban[index]!='' && json_usrban[index]!=undefined) {
                    userban = userban + json_usrban[index] + "\n";
                }
            }
            document.getElementById('extWebsites').value = userban;
        }
    });
    readFile(usr_proxies, function (dataReadFromFile, status) {
        var userproxy = '';
        if (!Components.isSuccessCode(status)) {
        } else {
            var json_usrproxya = JSON.parse(dataReadFromFile);
            var index;
            for (index = 0; index < json_usrproxya.length; ++index) {
                if(json_usrproxya[index]!='' && json_usrproxya[index]!=undefined) {
                    userproxy = userproxy + json_usrproxya[index].host + ":" + json_usrproxya[index].port + "|" + json_usrproxya[index].protocol + "\n";
                }
            }
            document.getElementById('extProxies').value = userproxy;
        }
    });
}

window.addEventListener("load", function () {
    loadPrefs();
}, false);