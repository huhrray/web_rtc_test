import { io } from "socket.io-client";

const socket = io("wss://localhost:5000", {
  rejectUnauthorized: false // WARN: please do not do this in production
});

export const VideoContainer = () => {
  let isChannelReady = false;
  let isInitiator = false;
  let isStarted = false;
  let localStream: any;
  let pc: RTCPeerConnection | null;
  let remoteStream;
  let turnReady;

  let pcConfig = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
        credential: "",
      },
    ],
  };

  // Set up audio and video regardless of what devices are present.
  let sdpConstraints = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  };

  /////////////////////////////////////////////

  let room = "foo";
  // Could prompt for room name:
  // room = prompt('Enter room name:');

  if (room !== "") {
    socket.emit("create or join", room);
    console.log("Attempted to create or  join room", room);
  }

  socket.on("created", function (room: string) {
    console.log("Created room " + room);
    isInitiator = true;
  });

  socket.on("full", function (room: string) {
    console.log("Room " + room + " is full");
  });

  socket.on("join", function (room: string) {
    console.log("Another peer made a request to join room " + room);
    console.log("This peer is the initiator of room " + room + "!");
    isChannelReady = true;
  });

  socket.on("joined", function (room) {
    console.log("joined: " + room);
    isChannelReady = true;
  });

  socket.on("log", function (array) {
    console.log.apply(console, array);
  });

  ////////////////////////////////////////////////

  function sendMessage(message: any) {
    console.log("Client sending message: ", message);
    socket.emit("message", message);
  }

  // This client receives a message
  socket.on("message", function (message) {
    console.log("Client received message:", message);
    if (message === "got user media") {
      console.log("GOT USER MEDIA SO MAYBE")
      maybeStart();
    } else if (message.type === "offer") {
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
      pc !== null &&
        pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === "answer" && isStarted) {
      pc !== null &&
        pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === "candidate" && isStarted) {
      let candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate,
      });
      pc !== null && pc.addIceCandidate(candidate);
    } else if (message === "bye" && isStarted) {
      handleRemoteHangup();
    }
  });

  ////////////////////////////////////////////////////

  let localVideo = document.getElementById("localVideo") as HTMLVideoElement;
  let remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;

  navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: true,
    })
    .then(gotStream)
    .catch(function (e) {
      alert("getUserMedia() error: " + e);
    });

  function gotStream(stream: any) {
    console.log("Adding local stream.");
    localStream = stream;
    (document.getElementById("localVideo") as HTMLVideoElement).srcObject =
      stream;
    sendMessage("got user media");
    if (isInitiator) {
      maybeStart();
    }
  }

  let constraints = {
    video: true,
  };

  console.log("Getting user media with constraints", constraints);

  // if (window.location.hostname !== "localhost") {
  //   requestTurn(
  //     "https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913"
  //   );
  // }

  function maybeStart() {
    console.log(
      ">>>>>>> maybeStart() ",
      isStarted,
      localStream,
      isChannelReady
    );
    if (!isStarted && typeof localStream !== "undefined" && isChannelReady) {
      console.log(">>>>>> creating peer connection");
      createPeerConnection();
      localStream.getTracks().forEach((track: MediaStreamTrack) => {
        pc?.addTrack(track, localStream)
      })
      // pc !== null && pc.addTrack(localStream);
      isStarted = true;
      console.log("isInitiator", isInitiator);
      if (isInitiator) {
        doCall();
      }
    }
  }

  window.onbeforeunload = function () {
    sendMessage("bye");
  };

  /////////////////////////////////////////////////////////

  function createPeerConnection() {
    try {
      pc = new RTCPeerConnection(undefined);
      pc.onicecandidate = handleIceCandidate;
      pc.ontrack = handleRemoteStreamAdded;
      pc.removeTrack = handleRemoteStreamRemoved;
      console.log("Created RTCPeerConnnection");
    } catch (e) {
      //   console.log("Failed to create PeerConnection, exception: " + e.message);
      alert("Cannot create RTCPeerConnection object.");
      return;
    }
  }

  function handleIceCandidate(event: any) {
    console.log("icecandidate event: ", event);
    if (event.candidate) {
      sendMessage({
        type: "candidate",
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate,
      });
    } else {
      console.log("End of candidates.");
    }
  }

  function handleCreateOfferError(event: any) {
    console.log("createOffer() error: ", event);
  }

  function doCall() {
    console.log("Sending offer to peer");
    pc !== null &&
      pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
  }

  function doAnswer() {
    console.log("Sending answer to peer.");
    pc !== null &&
      pc
        .createAnswer()
        .then(setLocalAndSendMessage, onCreateSessionDescriptionError);
  }

  function setLocalAndSendMessage(
    sessionDescription: RTCLocalSessionDescriptionInit | undefined
  ) {
    pc !== null && pc.setLocalDescription(sessionDescription);
    console.log("setLocalAndSendMessage sending message", sessionDescription);
    sendMessage(sessionDescription);
  }

  function onCreateSessionDescriptionError(error: any) {
    alert("Failed to create session description: " + error.toString());
  }

  function requestTurn(turnURL: any) {
    let turnExists = false;
    for (let i in pcConfig.iceServers) {
      if (pcConfig.iceServers[i].urls.substr(0, 5) === "turn:") {
        turnExists = true;
        turnReady = true;
        break;
      }
    }
    if (!turnExists) {
      console.log("Getting TURN server from ", turnURL);
      // No TURN server. Get one from computeengineondemand.appspot.com:
      let xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
          let turnServer = JSON.parse(xhr.responseText);
          console.log("Got TURN server: ", turnServer);
          pcConfig.iceServers.push({
            urls: "turn:" + turnServer.username + "@" + turnServer.turn,
            credential: turnServer.password,
          });
          turnReady = true;
        }
      };
      xhr.open("GET", turnURL, true);
      xhr.send();
    }
  }

  function handleRemoteStreamAdded(event: any) {
    console.log("Remote stream added.");
    remoteStream = event.stream;
    (document.getElementById("remoteVideo") as HTMLVideoElement).srcObject =
      remoteStream;
  }

  function handleRemoteStreamRemoved(event: any) {
    console.log("Remote stream removed. Event: ", event);
  }

  function hangup() {
    console.log("Hanging up.");
    stop();
    sendMessage("bye");
  }

  function handleRemoteHangup() {
    console.log("Session terminated.");
    stop();
    isInitiator = false;
  }

  function stop() {
    isStarted = false;
    pc !== null && pc.close();
    pc = null;
  }

  return (
    <div id="videos">
      <video id="localVideo" autoPlay muted playsInline></video>
      <video id="remoteVideo" autoPlay playsInline></video>
    </div>
  );
};
