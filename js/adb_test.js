

// TODO

var requestButtonGN = document.getElementById("requestPermissionGN");
var disconnectButton = document.getElementById("shell_button");
var clearButton = document.getElementById("clear_button");


requestButtonGN.addEventListener('click', function() {
	adb_driver_init(0x04e8, 0x6866);
});

disconnectButton.addEventListener('click', function() {
//	adb_driver_destroy();
	adb_driver_shell();
});


clearButton.addEventListener('click', function() {
	document.getElementById('console').innerText = "";
})



function adb_test() {

}


