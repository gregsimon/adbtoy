

// TODO

var requestButtonGN = document.getElementById("requestPermissionGN");
var disconnectButton = document.getElementById("disconnect");


requestButtonGN.addEventListener('click', function() {
	adb_driver_init(0x04e8, 0x6866);
});

disconnectButton.addEventListener('click', function() {
	adb_driver_disconnect();
});



function adb_test() {

}


