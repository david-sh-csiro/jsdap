import JsDap from '../lib/'
// disable IE_HACK as default
var jsdap = new JsDap(false);

// if you want IE_HACK, just set the flag as true during initialize
// var jsdap = new JsDap(true);

function loadData() {
    var url = document.getElementById('dods_url').value;
    var ta = document.getElementById('dods_textarea');
    jsdap.loadData(url, function(data) {
        ta.value = JSON.stringify(data, null, 2);
    });
    return false;
}

function loadDataset() {
    var url = document.getElementById('dds_url').value;
    var ta = document.getElementById('dds_textarea');
    jsdap.loadDataset(url, function(data) {
        ta.value = JSON.stringify(data, null, 2);
    });
    return false;
}

onload = (event) => {
    let dods_button = document.getElementById('dods_button');
    let dds_button = document.getElementById('dds_button');
    dods_button.onclick = loadData;
    dds_button.onclick = loadDataset;
};