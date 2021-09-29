"use strict";

import {dasParser, ddsParser} from "./parser.js";
import {dapUnpacker, getBuffer} from "./xdr.js";
import ieHack from "./vbscript.js";

export default class JsDap {
    constructor(IE_HACK = false) {
        this.IE_HACK = IE_HACK;
        ieHack(this.IE_HACK);
    }

    proxyUrl(url, callback, binary, extraheaders, withCredentials) {
        let xml = undefined;

        // Mozilla/Safari/IE7+
        if (window.XMLHttpRequest) {
            xml = new XMLHttpRequest();
            // IE6
        } else if (window.ActiveXObject) {
            xml = new window.ActiveXObject("Microsoft.XMLHTTP");
        }

        if (withCredentials === true) xml.withCredentials = true;
        xml.open("GET", url, true);
        if (xml.overrideMimeType) {
            xml.overrideMimeType("text/plain; charset=x-user-defined");
        } else {
            xml.setRequestHeader("Accept-Charset", "x-user-defined");
        }
        if (extraheaders) {
            for (let key in extraheaders) {
                xml.setRequestHeader(key, extraheaders[key]);
            }
        }

        xml.onreadystatechange = function() {
            if (xml.readyState == 4) {
                if (!binary) {
                    callback(xml.responseText);
                } else if (this.IE_HACK) {
                    callback(BinaryToArray(xml.responseBody).toArray());
                } else {
                    callback(getBuffer(xml.responseText));
                }
            }
        };
        xml.send("");
    }

    /** Flatten the data array as data attributes of elements of daplet */
    _applydata(data, daplet) {
        let i = 0;
        for (let child in daplet) {
            if (!daplet[child].type) continue;
            daplet[child].data = data[i++];
            if (daplet[child].type == "Structure") {
                this._applydata(daplet[child].data, daplet[child]);
            }
        }
    }

    /**
     * Load the dataset and call the callback with (data) where data is an array of data
     * the url must be a url with .dods extension.
     * @params:
     * - url (string): the url (must be a .dods url, it might have additonnal slicing OpENDAP query string)
     * - callback (function(data)): the callback which will receive parsed data.
     * - extraheaders (map/object) : Javascript Object or map that contains keys and values of additonnal headers for the request.
     */
    loadData(url, callback, extraheaders, withCredentials) {
        this.proxyUrl(
            url,
            dods => {
                let dds = "";
                while (!dds.match(/\nData:\n$/)) {
                    let c = dods.splice(0, 1);
                    if (c.length === 0) throw new Error("Error reading data, are you sur this is a .dods request ?");
                    dds += String.fromCharCode(c);
                }
                dds = dds.substr(0, dds.length - 7);

                let daplet = new ddsParser(dds).parse();
                let data = new dapUnpacker(dods, daplet).getValue();
                this._applydata(data, daplet);
                callback(daplet);
            },
            true,
            extraheaders,
            withCredentials
        );
    }

    /**
     * Load the dataset and call the callback with (dataset) where dataset is the dataset "metadata";
     * - url (string): the url (must be a bare OPeNDAP url, without "format extension" nor query parameters).
     * - callback (function(data)): the callback which will receive parsed data.
     * - extraheaders (map/object) : Javascript Object or map that contains keys and values of additonnal headers for the request.
     */
    loadDataset(url, callback, extraheaders, withCredentials) {
        // Load DDS.
        this.proxyUrl(
            url + ".dds",
            dds => {
                let dataset = new ddsParser(dds).parse();

                // Load DAS.
                this.proxyUrl(
                    url + ".das",
                    function(das) {
                        dataset = new dasParser(das, dataset).parse();
                        callback(dataset);
                    },
                    false,
                    extraheaders
                );
            },
            false,
            extraheaders,
            withCredentials
        );
    }
}
