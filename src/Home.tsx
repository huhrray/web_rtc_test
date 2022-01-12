import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { VideoContainer } from "./components/VideoContainer"
import { VoiceContainer } from "./components/VoiceContainer";

const pc_config = {
    iceServers: [
        // {
        //     "urls": ["turn:175.197.203.14:3478?transport=tcp"],
        //     "username": "seyhuh",
        //     "credential": "1234"
        // }
        {
            urls: "stun:stun.l.google.com:19302",
        },
    ],
};
const SOCKET_SERVER_URL = "wss://192.168.0.2:7000"
const IO = io(SOCKET_SERVER_URL);
const PC = new RTCPeerConnection(pc_config);

export const Home = () => {
    const socketRef = useRef<Socket>();//
    const pcRef = useRef<RTCPeerConnection>();
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const setVideoTracks = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            if (!(pcRef.current && socketRef.current)) return;
            stream.getTracks().forEach((track) => {
                if (!pcRef.current) return;
                pcRef.current.addTrack(track, stream);
            });
            pcRef.current.onicecandidate = (e) => {
                if (e.candidate) {
                    if (!socketRef.current) return;
                    console.log("onicecandidate");
                    socketRef.current.emit("candidate", e.candidate);
                }
            };
            pcRef.current.oniceconnectionstatechange = (e) => {
                // console.log(e);
            };
            pcRef.current.ontrack = (ev) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = ev.streams[0];
                }
            };
            socketRef.current.emit("join_room", {
                room: "1234",
            });
        } catch (e) {
            console.error(e);
        }
    };

    const createOffer = async () => {
        console.log("create offer");
        if (!(pcRef.current && socketRef.current)) return;
        try {
            const sdp = await pcRef.current.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            })
            await pcRef.current.setLocalDescription(new RTCSessionDescription(sdp));
            socketRef.current.emit("offer", sdp);
        } catch (e) {
            console.error(e);
        }
    };

    const createAnswer = async (sdp: RTCSessionDescription) => {
        if (!(pcRef.current && socketRef.current)) return;
        try {
            // console.log(pcRef.current.getTransceivers()[1].setCodecPreferences(), "뭡니까")
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
            console.log("answer set remote description success");
            const mySdp = await pcRef.current.createAnswer({
                offerToReceiveVideo: true,
                offerToReceiveAudio: true,
            });
            console.log("create answer");
            await pcRef.current.setLocalDescription(new RTCSessionDescription(mySdp));
            socketRef.current.emit("answer", mySdp);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        socketRef.current = IO;
        pcRef.current = PC;

        socketRef.current.on("all_users", (allUsers: Array<{ id: string }>) => {
            if (allUsers.length > 0) {
                createOffer();
            }
        });

        socketRef.current.on("getOffer", (sdp: RTCSessionDescription) => {
            //console.log(sdp);
            console.log("get offer");
            createAnswer(sdp);
        });

        socketRef.current.on("getAnswer", (sdp: RTCSessionDescription) => {
            console.log("get answer");
            if (!pcRef.current) return;
            pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
            //console.log(sdp);
        });

        socketRef.current.on(
            "getCandidate",
            async (candidate: RTCIceCandidateInit) => {
                if (!pcRef.current) return;
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("candidate add success");
            }
        );
        socketRef.current.on("room_full", (sdp: RTCSessionDescription) => {
            console.log("get answer");
            if (!pcRef.current) return;
            pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
            //console.log(sdp);
        });

        setVideoTracks();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (pcRef.current) {
                pcRef.current.close();
            }
        };

    }, []);

    return (
        <div className="home">
            <h1>Realtime communication with WebRTC</h1>
            <div className="content-container">
                {VideoContainer(localVideoRef, remoteVideoRef)}
                {VoiceContainer(IO, PC)}
            </div>
        </div>)
}

