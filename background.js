
chrome.app.runtime.onLaunched.addListener(function() { 
  // Tell your app what to launch and how.
  chrome.app.window.create('main.html', {
    width: 640,
    height: 480,
    minWidth: 640,
    minHeight: 480,
    left: 10,
    top: 10,
    type: 'shell'
  });

});
