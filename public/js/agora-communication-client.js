/*
 * JS Interface for Agora.io SDK
 */
// create client instances for camera (client) and screen share (screenClient)
var agoraClient = AgoraRTC.createClient({mode: 'rtc', codec: 'vp8'}); 
window.screenClient = AgoraRTC.createClient({mode: 'rtc', codec: 'vp8'}); 

// stream references (keep track of active streams) 
window.remoteStreams = {}; // remote streams obj struct [id : stream] 


// keep track of streams
window.localStreams = {
  uid: '',
  camera: {
    camId: '',
    micId: '',
    stream: {}
  },
  screen: {
    id: "",
    stream: {}
  }
};

// keep track of devices
window.devices = {
  cameras: [],
  mics: []
}

var mainStreamId; // reference to main stream
var screenShareActive = false; // flag for screen share 

window.AGORA_COMMUNICATION_CLIENT = {
  initClientAndJoinChannel: initClientAndJoinChannel,
  agoraJoinChannel: agoraJoinChannel,
  addRemoteStreamView: addRemoteStreamView,
  agoraLeaveChannel: agoraLeaveChannel
};

function initClientAndJoinChannel(agoraAppId, channelName) {
  // init Agora SDK
  agoraClient.init(agoraAppId, function () {
    AgoraRTC.Logger.info("AgoraRTC client initialized");
    agoraJoinChannel(channelName); // join channel upon successfull init
  }, function (err) {
    AgoraRTC.Logger.error("[ERROR] : AgoraRTC client init failed", err);
  });
}


agoraClient.on('stream-published', function (evt) {
  AgoraRTC.Logger.info("Publish local stream successfully");
});

// connect remote streams
agoraClient.on('stream-added', function (evt) {
  var stream = evt.stream;
  var streamId = stream.getId();
  AgoraRTC.Logger.info("new stream added: " + streamId);

  // Check if the stream is local
  if (streamId != window.localStreams.screen.id) {
    AgoraRTC.Logger.info('subscribe to remote stream:' + streamId);
    // Subscribe to the stream.
    agoraClient.subscribe(stream, function (err) {
      AgoraRTC.Logger.error("[ERROR] : subscribe stream failed", err);
    });
  }
});

agoraClient.on('stream-subscribed', function (evt) {
  var remoteStream = evt.stream;
  var remoteId = remoteStream.getId();
  window.remoteStreams[remoteId] = remoteStream;
  // console.log('Stream subscribed:', remoteId);

  AgoraRTC.Logger.info("Subscribe remote stream successfully: " + remoteId);

  // show new stream on screen:
  addRemoteStreamView(remoteStream);
  
  // always add 1 due to the remote streams + local user
  const usersCount = Object.keys(window.remoteStreams).length + 1
  window.AGORA_UTILS.updateUsersCounter(usersCount)
});

agoraClient.on('stream-removed', function(evt) {
  console.log('REMOVED: ', evt.uid);
})

// remove the remote-container when a user leaves the channel
agoraClient.on("peer-leave", function(evt) {
  if (!evt || !evt.stream) {
    console.error('Stream undefined cannot be removed', evt);
    return false;
  }
  console.log('peer-leave:', evt);
  var streamId = evt.stream.getId(); // the the stream id
  jQuery('#uid-'+streamId).remove();

  if(remoteStreams[streamId] !== undefined) {
    remoteStreams[streamId].stop(); // stop playing the feed
    delete remoteStreams[streamId]; // remove stream from list
    const remoteContainerID = '#' + streamId + '_container';
    jQuery(remoteContainerID).empty().remove(); 

    // always is +1 due to the remote streams + local user
    const usersCount = Object.keys(window.remoteStreams).length + 1
    window.AGORA_UTILS.updateUsersCounter(usersCount)
  }
});

// show mute icon whenever a remote has muted their mic
agoraClient.on("mute-audio", function (evt) {
  window.AGORA_UTILS.toggleVisibility('#' + evt.uid + '_mute', true);
});

agoraClient.on("unmute-audio", function (evt) {
  window.AGORA_UTILS.toggleVisibility('#' + evt.uid + '_mute', false);
});

// show user icon whenever a remote has disabled their video
agoraClient.on("mute-video", function (evt) {
  var remoteId = evt.uid;
  // if the main user stops their video select a random user from the list
  if (remoteId != mainStreamId) {
    // if not the main vidiel then show the user icon
    window.AGORA_UTILS.toggleVisibility('#' + remoteId + '_no-video', true);
  }
});

agoraClient.on("unmute-video", function (evt) {
  window.AGORA_UTILS.toggleVisibility('#' + evt.uid + '_no-video', false);
});

// join a channel
function agoraJoinChannel(channelName) {
  var token = window.AGORA_TOKEN_UTILS.agoraGenerateToken();
  var userId = window.userID || 0; // set to null to auto generate uid on successfull connection
  agoraClient.join(token, channelName, userId, function(uid) {
    AgoraRTC.Logger.info("User " + uid + " join channel successfully");
    window.localStreams.camera.id = uid; // keep track of the stream uid 
    createCameraStream(uid);
  }, function(err) {
      AgoraRTC.Logger.error("[ERROR] : join channel failed", err);
  });
}

// video streams for channel
function createCameraStream(uid) {
  var localStream = AgoraRTC.createStream({
    streamID: uid,
    audio: true,
    video: true,
    screen: false
  });
  localStream.setVideoProfile(window.cameraVideoProfile);
  localStream.on("accessAllowed", function() {
    if(window.devices.cameras.length === 0 && window.devices.mics.length === 0) {
      AgoraRTC.Logger.info('[DEBUG] : checking for cameras & mics');
      window.AGORA_UTILS.getCameraDevices();
      window.AGORA_UTILS.getMicDevices();
    }
    AgoraRTC.Logger.info("accessAllowed");
  });

  localStream.init(function() {
    jQuery('#rejoin-container').hide();
    jQuery('#buttons-container').removeClass('hidden');

    var thisBtn = jQuery('#rejoin-btn');
    thisBtn.prop("disabled", false);
    thisBtn.find('.spinner-border').hide();

    AgoraRTC.Logger.info("getUserMedia successfully");
    // TODO: add check for other streams. play local stream full size if alone in channel
    localStream.play('local-video'); // play the given stream within the local-video div

    // publish local stream
    agoraClient.publish(localStream, function (err) {
      AgoraRTC.Logger.error("[ERROR] : publish local stream error: " + err);
    });
  
    window.AGORA_COMMUNICATION_UI.enableUiControls(localStream); // move after testing
    window.localStreams.camera.stream = localStream; // keep track of the camera stream for later
  }, function (err) {
    AgoraRTC.Logger.error("[ERROR] : getUserMedia failed", err);
  });
}


// REMOTE STREAMS UI
function addRemoteStreamView(remoteStream){
  var streamId = remoteStream.getId();
  console.log('Adding remote to main view:', streamId);
  // append the remote stream template to #remote-streams
  const streamsContainer = jQuery('#screen-users');

  streamsContainer.append(
      jQuery('<div/>', {'id': streamId + '_container',  'class': 'user remote-stream-container'}).append(
        jQuery('<div/>', {'id': streamId + '_mute', 'class': 'mute-overlay'}).append(
            jQuery('<i/>', {'class': 'fas fa-microphone-slash'})
        ),
        jQuery('<div/>', {'id': streamId + '_no-video', 'class': 'no-video-overlay text-center'}).append(
          jQuery('<i/>', {'class': 'fas fa-user'})
        ),
        jQuery('<div/>', {'id': 'agora_remote_' + streamId, 'class': 'remote-video'})
      )
    );

  remoteStream.play('agora_remote_' + streamId);

  /*
  var containerId = '#' + streamId + '_container';
  jQuery(containerId).dblclick(function() {
    // play selected container as full screen - swap out current full screen stream
    remoteStreams[mainStreamId].stop(); // stop the main video stream playback
    addRemoteStreamView(remoteStreams[mainStreamId]); // send the main video stream to a container
    const parentCircle = jQuery(containerId).parent();
    if (parentCircle.hasClass('avatar-circle')) {
      parentCircle.find('img').show();
    }
    jQuery(containerId).empty().remove(); // remove the stream's miniView container
    remoteStreams[streamId].stop() // stop the container's video stream playback
    remoteStreams[streamId].play('video-canvas'); // play the remote stream as the full screen video
    mainStreamId = streamId; // set the container stream id as the new main stream id
  }); */
}

function agoraLeaveChannel() {
  
  if(screenShareActive) {
    window.AGORA_SCREENSHARE_UTILS.stopScreenShare();
  }

  agoraClient.leave(function() {
    AgoraRTC.Logger.info("client leaves channel");
    window.localStreams.camera.stream.stop() // stop the camera stream playback
    agoraClient.unpublish(window.localStreams.camera.stream); // unpublish the camera stream
    window.localStreams.camera.stream.close(); // clean up and close the camera stream
    jQuery("#remote-streams").empty() // clean up the remote feeds
    //disable the UI elements
    jQuery("#mic-btn").prop("disabled", true);
    jQuery("#video-btn").prop("disabled", true);
    jQuery("#screen-share-btn").prop("disabled", true);
    jQuery("#exit-btn").prop("disabled", true);
    // hide the mute/no-video overlays
    window.AGORA_UTILS.toggleVisibility("#mute-overlay", false); 
    window.AGORA_UTILS.toggleVisibility("#no-local-video", false);

    jQuery('#rejoin-container').show();
    jQuery('#buttons-container').addClass('hidden');
    
    // show the modal overlay to join
    // jQuery("#modalForm").modal("show"); 
  }, function(err) {
    AgoraRTC.Logger.error("client leave failed ", err); //error handling
  });
}
