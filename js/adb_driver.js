

console.log("Chrome ADB Driver");

var device = null;  // "global" object for this driver.

var ADB_PACKET_SIZE = 0x40;

var A_SYNC = 0x434e5953;
var A_CNXN = 0x4e584e43;
var A_OPEN = 0x4e45504f;
var A_OKAY = 0x59414b4f;
var A_CLSE = 0x45534c43;
var A_WRTE = 0x45545257;
var A_AUTH = 0x48545541;


// There are two state machines implemented here. One is for sending/receiving
// the messages since there are multiple bulk transfers involved on each side.
// The other state machine is for managing the connection with the remote
// device (e.g.,  dealing with AUTH, etc.)

// Message SM
var M_SM_IDLE = 0;
var M_SM_SENDING1 = 1;
var M_SM_SENDING2 = 2;
var M_SM_RECEIVING1 = 5;
var M_SM_RECEIVING2 = 6;

// connection SM
var C_SM_DISCONNECTED = 0;
var C_SM_CONNECTED_PENDING_INTERFACE = 1;
var C_SM_CONNECTED = 2;
var C_SM_SENT_CNXN = 3;


var sm_msg = M_SM_IDLE;
var sm_c = C_SM_DISCONNECTED;


function adb_log(str) {
  console.log(str);
}

function adb_driver_init(vendorId, productId) {
  // reset the state machines
  device = new Object();
  device.productId = productId;
  device.vendorId = vendorId;

  sm_c = C_SM_DISCONNECTED;

  // attempt to connect a device.
  chrome.permissions.request(
      {permissions: [
          {'usbDevices': [{'vendorId': device.vendorId,
                "productId": device.productId}] }
       ]},
       function(result) {
        if (result) {
          adb_log('App was granted the "usbDevices" permission.');
          chrome.usb.findDevices(
              { "vendorId": device.vendorId,
                "productId": device.productId},
             adb_driver_init2);
        } else {
          adb_log('App was NOT granted the "usbDevices" permission.');
        }
    });
}

function adb_driver_init2(devices) {
  if (!devices || !devices.length) {
    adb_log("unable to find the device.");
    return;
  }

  // ok we got a device, set it up.
  adb_log(devices.length+" device(s) found, connected : productId=0x" +
        devices[0].productId.toString(16) +
        " vendorId=0x"+devices[0].vendorId.toString(16));
  device.device = devices[0];


  // Now we have connected to to the usb bus the device is
  // on. We have not authenticated with the device yet. This wiill
  // require exchanging some messages.
  sm_c = C_SM_CONNECTED_PENDING_INTERFACE;

  chrome.usb.claimInterface(device.device, 1, adb_driver_init3);
}

function adb_driver_init3() {
  // Now we are connected to the usb interface we want on the device.
  sm_c = C_SM_CONNECTED;

  // send a CONNECTION message to the device to say hello.
  // The callback for this will be handlded by the singleton
  // message receiver which will process the state machine.

  adb_queue_outgoing_msg(A_CNXN, 0x01000000, 4096, "host::");

}

function adb_driver_destroy() {
}

// This is called when a message has finished being sent.
// Use the SM to find out what to do next.
function adb_msg_sent() {
  // actually, we'll just queue a listen here.
  chrome.usb.bulkTransfer(device.device,
    {direction:'in', endpoint:0x83, length:24}, function(uevent) {
      // we should have gotten the header.
      //adb_log("get header  result="+uevent.resultCode+"... "+uevent.data.byteLength+"bytes");
      var msg = adb_unpack_msg_header(uevent.data);

      // now phase 2 -- receive the bulk transfer for the boyd.
      if (msg.bodySize > 0) {
        chrome.usb.bulkTransfer(device.device,
          {direction:'in', endpoint:0x83, length:msg.bodySize},
          function(uevent) {
            msg.body = uevent.data;
            adb_process_incoming_msg(msg);
          });

      } else {
        // this message is complete, send it for processing.
        adb_process_incoming_msg(msg);
      }
    });
}

// TODO : move this somewhere
// openssl genrsa -out mykey.pem 256

var pub_key = "\
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA9dPzWGssue+hHW4AODSy\
EEwiZIX4Q4TSb/DnwYXhTWYbD+IeL+UwvZA5yTUJzSZBIiHam7p6WRSlDbnm4tfI\
QN6E56ZXm8N3g1in3UKx1LM2lO/Ia3EorCRWZbFYiTuR51JyJ9PTD9le7egz4Ng/\
C68IMkxr509o2dAqYt/OOonoOVPxSqo3/NzS5qo3HTYKd9HQvALLRldAJ7qYS4Zy\
6XIrL+b6iJC5DeLB0NeH2BxfIEu3v+lMuO2WezBGkyu/mIBsSQcvO4WvAG2mf9Yd\
MJ+xXIqW3IY0Tbzs3To1h7WtktXO6aXa5MCbJMKtMOA7duCx/4wl3JA1DvFLt8OO\
mQIDAQAB";

var priv_key = "\
MIIEpQIBAAKCAQEA9dPzWGssue+hHW4AODSyEEwiZIX4Q4TSb/DnwYXhTWYbD+Ie\
L+UwvZA5yTUJzSZBIiHam7p6WRSlDbnm4tfIQN6E56ZXm8N3g1in3UKx1LM2lO/I\
a3EorCRWZbFYiTuR51JyJ9PTD9le7egz4Ng/C68IMkxr509o2dAqYt/OOonoOVPx\
Sqo3/NzS5qo3HTYKd9HQvALLRldAJ7qYS4Zy6XIrL+b6iJC5DeLB0NeH2BxfIEu3\
v+lMuO2WezBGkyu/mIBsSQcvO4WvAG2mf9YdMJ+xXIqW3IY0Tbzs3To1h7WtktXO\
6aXa5MCbJMKtMOA7duCx/4wl3JA1DvFLt8OOmQIDAQABAoIBAQCCX28OdICa99hl\
qEIbjO7mr8oJr/dTr6x/S69Ntjgf+Ufe65gA5LctwcCz0hopn+EpPfUXZBWhCs7i\
cbZelfwRUzH/PPv3kvneQfV85fM0D/uhj22mdbQRX5AmjKCc32fo25PJRZEJNcof\
uGdTFryQ8LoTGu6bFUVRRxJDr9hKuHDC+psE+KOaPhGjFl9StNJCGuV9tWaRq3Jq\
ad0oDL5vkD6JOtafT3K1AXPA1mctNvbpiIfre8gsZCo1K2/yBJK3C7D88OSAphI9\
ruVz+HL8t5n/61oWBroA877OelA7uQGOlUzUbnf5UG5wrkfnpmqT0QZQ/EhUR8wX\
+8CmRlYFAoGBAP1xvoxE42Xz7aOInBLVQYU2UVSDlsRXjrSzsDm1mO63bDrtMWdW\
9zDu1bInR6WsLgi8qjjnNx3CTTNfX63+V8Z03y4pBA5nRb18EeDhrtFsXX9ZcMJT\
nwHXjZP3flHSXYr6712SP4vYGLwqPf+5MIrISU7nn9MAvYNAKEQ0o7hfAoGBAPhO\
i3z2mzwqBa/xxq3rC/Fdt7qX/Tg4vU3yFx1lGmeyQe+/tmTEtXQzrEvIvv//PJCO\
wIt2nOZgONq2mg/D6U4wxi4V+zySFt4FxnsvDd7vFYxaQNwLcwHhtvBo7Qxm7iMk\
NIVCbZcXnM12eRhICXkWCMbbp6OHK9mp5n5ltPwHAoGBANUERB6LTAGF+wdHK77c\
hPxdAhChpReTa/tPR9/JVSfW/N2uPKbZvlvfcbcSMrL5u5tWT1ASbg3SIKb8E2Qf\
cVD5LBgVGzar8D7px/EWXqPgi9kcqJx8Qhn/PRzPmNlWkY7diFBCOqzkTS3h50hH\
M5iB7LOoFHn5lk95nh5ti+nLAoGBAJGLCHvQ2KDlSLwejYQ3t6Jcemrm18fyihN8\
CUxzjIynkbqDttdN7cYU27L4EexfoRJiej3E4qauU+TvD1KaVNA+CovM2pxgTQMK\
g5KEvC6mGQ1RgZ75HwpFUUONXRTd6Eu01wwdKbtcXc6Y2NYAs3zEC5Tz/0j83BkT\
W0VPPExVAoGABtqV3GpPwoez0ru0Zzn3BspUuTVI6MgVcFDveFwhEkM1oeyiFtRa\
v2LUEqo1JI6/AQczD5me1nsX5q5Namer3Jbf0tE+n/GpX5GhjjqduXn1lClcYbZD\
ifeH07bBDIOkkaJwqxHs3Y0IL8gderuG2Ps5gKqKy/vX7NaVW+d2AiM=";

var rsa = new RSAKey();
rsa.readPrivateKeyFromPEMString(priv_key);

// This is the entry point for ALL incoming messages.
// The state machine decides what to do here.
function adb_process_incoming_msg(msg) {
  adb_log("IN: "+msg.name+" arg0="+msg.arg0+" arg1="+msg.arg1);
  switch(msg.cmd) {
    case A_AUTH:
      if (msg.arg0 == 1) {
        // data is a random token that the receipient (us) can sign with a
        // private key. We'll sign and send back! This is a 256
        //var signed = rsa.signString(msg.body, "sha256");
        //adb_log("signed -> "+signed);
        adb_queue_outgoing_msg(A_AUTH, 3, 0, pub_key);

      } else {

      }
    break;

    default:
    adb_log("UNHANDLED MESSAGE");
  }
}

// Pack up a message and queue it for sending.
function adb_queue_outgoing_msg(cmd, arg0, arg1, str) {
  var msg = adb_pack_msg(cmd, arg0, arg1, str);

  msg.phase = 0;

  chrome.usb.bulkTransfer(device.device,
    {direction:'out', endpoint:0x03, data:msg.header}, function(ti) {
      //adb_log("sent header, "+ti.resultCode);
      chrome.usb.bulkTransfer(device.device,
        {direction:'out', endpoint:0x03, data:msg.body}, adb_msg_sent);
    });

  //adb_log("msg packed, "+msg.header.byteLength+" bytes, "+msg.body.byteLength+" bytes");
}

function adb_unpack_msg_header(buffer) {
  var endian = true;
  var bv = new DataView(buffer);

  var m = {};
  m.cmd = bv.getUint32(0, endian);
  m.arg0 = bv.getUint32(4, endian);
  m.arg1 = bv.getUint32(8, endian);
  m.bodySize = bv.getUint32(12, endian);

  switch (m.cmd) {
    case A_SYNC: m.name = "SYNC"; break;
    case A_CNXN: m.name = "CNXN"; break;
    case A_OPEN: m.name = "OPEN"; break;
    case A_OKAY: m.name = "OKAY"; break;
    case A_CLSE: m.name = "CLSE"; break;
    case A_WRTE: m.name = "WRTE"; break;
    case A_AUTH: m.name = "AUTH"; break;
    default:
    m.name = "????";
  }

  adb_log("unpacked: 0x"+m.cmd.toString(16)+
    "("+m.name+
    ") 0x"+m.arg0.toString(16)+
    " 0x"+m.arg1.toString(16)+
      "  data is "+m.bodySize+" bytes ...");

  return m;
}

function adb_pack_msg(cmd, arg0, arg1, str) {
  var m = {};

 // the string must be interpreted as a string of bytes.
  var dump_msg = false;

  if (dump_msg)
    adb_log(" ------ adb_write_msg ------");

   var payloadBuf = new ArrayBuffer(str.length+0);
   var sbufView = new Uint8Array(payloadBuf);
   for (var i=0, strLen=str.length; i<strLen; i++) {
     sbufView[i] = str.charCodeAt(i);
   }
   var crc = crc32(str);

  adb_log( "OUT cmd=0x"+cmd.toString(16)+", 0x"+arg0.toString(16)+", 0x"+arg1.toString(16)+", \""+str+"\"");
  if (dump_msg)
    adb_log("pack, string is "+payloadBuf.byteLength+" bytes long  crc="+crc.toString(16)+" -> "+str);

  var endian = true;
  var buffer = new ArrayBuffer(24);
  var bufferView = new DataView(buffer);
  bufferView.setUint32(0, cmd, endian);
  bufferView.setUint32(4, arg0, endian);
  bufferView.setUint32(8, arg1, endian);
  bufferView.setUint32(12, payloadBuf.byteLength, endian);
  bufferView.setUint32(16, crc, endian);
  bufferView.setUint32(20, (cmd ^ 0xffffffff), endian);

  if (dump_msg)
    adb_log("len="+buffer.byteLength+"  checksum="+bufferView.getUint32(20, endian).toString(16));

  m.header = buffer;
  m.body = payloadBuf;

  return m;
}



// Crc32 utils ----------------------------------------------------------------------------

function Utf8Encode(string) {
    string = string.replace(/\r\n/g,"\n");
    var utftext = "";

    for (var n = 0; n < string.length; n++) {
        var c = string.charCodeAt(n);
        if (c < 128) {
            utftext += String.fromCharCode(c);
        } else if((c > 127) && (c < 2048)) {
            utftext += String.fromCharCode((c >> 6) | 192);
            utftext += String.fromCharCode((c & 63) | 128);
        } else {
            utftext += String.fromCharCode((c >> 12) | 224);
            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
            utftext += String.fromCharCode((c & 63) | 128);
        }
    }
    return utftext;
};

function crc32 (str) {
    var s = Utf8Encode(str);
    var c = 0;
    for (i=0; i<s.length; i++) {
      c += s.charCodeAt(i);
    }
    return c;
};



