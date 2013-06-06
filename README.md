USB ADB Adapter for Chrome
==========================

This project is a packaged chrome app that uses the Chrome USB API to implement the ADB protocol. The [Chrome USB API](http://developer.chrome.com/apps/usb.html) allows you to do various USB transfers (bulk, interrupt, control) directly from JavaScript. You can use DataView, etc. to parse the binary results or package buffers for output. 


You can read more about the ADB protocol [here](https://android.googlesource.com/platform/system/core/+/master/adb/OVERVIEW.TXT) and look at the source code [here](https://android.googlesource.com/platform/system/core/+/master/adb).

Status
------

### 4-June-2013
Right now you can connect to a device. You can't do a directly listing or open a socket yet.
