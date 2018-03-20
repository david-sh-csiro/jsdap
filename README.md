# JavaScript AJAX client for DAP services

## Introduction

[OPeNDAP](http://www.opendap.org/) protocol allows publishing huge datasets over internet. The protocols allows describing and querying data in various formats.

This library is designed to allow querying DAP dataset in AJAX based on the url. Main library code is from [Roberto De Almeida's jsdap project on google code](https://code.google.com/p/jsdap/).

## Setup

The script is packed as `UMD` module and transpile down to `ES5` (`dist/jsdap`). However, you can only use it as `ES6 module` or `AMD` module. Since
the script relies on `window.XMLHttpRequest`, it is not available on `NODE` environment.

The **dist/index.html** is a good quickstart to load the libraries.
Notice also that the cross domain limitations apply to OPeNDAP servers and thus requests must be properly managed or CORS enabled.

A quick start (make sure you have `yarn` or `npm` install), following is example with `yarn`:

    // Download the dependencies (in the proj folder)
    $ yarn

    // Then you bring the webpack-dev server up and checkout the example
    $ yarn serve

    // If you want to rebuild the dist again, then
    $ yarn build

## Usage

To load a dataset the _loadData_ function can be used this way (`ES6` exampe) :

    import JsDap from './dist/jsdap.js';

    // if you want the IE_HACK, set the flag as true
    let jsdap = new JsDap(false);

    jsdap.loadData("http://www.example.com/dapserver/mydataset.nc.dods?time[1][1:5]",
    	function(data) {
    		console.log("Received data");
    		console.log(data);
    	});

Notice that the url **MUST** be a .dods request and that you _CAN_ add additionnaly DAP query.

To only load the dataset (ie. information about the structure of data) :
    
    import JsDap from './dist/jsdap.js';
     
    // if you want the IE_HACK, set the flag as true
    let jsdap = new JsDap(false);
    
    jsdap.loadDataset("http://www.example.com/dapserver/mydataset.nc.dds",
        function(info) {
            console.log(info);
        });

Notice that the url **MUST** be a .dds request and you **CANNOT** add additonnal DAP query/

An extra parameter can be added to send additionnal headers to the request.

Of cause, you can still go with the old school way, load the script into the `<script>` tag,
there you go:

    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>OpenDap</title>
    <script type="text/javascript" src="jsdap.js"></script></head>
    <body>
    <script type="text/javacript">

        // disable IE_HACK as default
        var jsdap = new JsDap(false);

        // if you want IE_HACK, just set the flag as true during initialize
        // var jsdap = new JsDap(true);

        // load data
        jsdap.loadData("http://www.example.com/dapserver/mydataset.nc.dods?time[1][1:5]",
            function(data) {
                console.log("Received data");
                console.log(data);
            });

        // load dataset
        jsdap.loadDataset("http://www.example.com/dapserver/mydataset.nc.dds",
            function(info) {
                console.log(info);
            });
    </script>
    </body>
    </html>

## Troubleshooting

1.  Your requests fail ? Careful about **cross domain requests**
2.  You have parsing errors in loadData ? Ensure you passed in .dods request not .ascii or other.
3.  You have parsing errors with loadDataset ? Ensure you are doing a .dds request.

Not enought ? Contact me at contact@obenhamid.me or http://obenhamid.me
