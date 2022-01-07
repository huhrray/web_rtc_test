import { makeVar } from '@apollo/client';
import { useEffect, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { io, Socket } from 'socket.io-client';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

export const VOICE_SCRIPT = makeVar<string>('');
const USER_NAME = makeVar<string>("UserName")
// export const FINAL_VOICE = makeVar<string | null>(null);

export const VoiceContainer = (socket: Socket<DefaultEventsMap, DefaultEventsMap> | undefined, peerConnection: RTCPeerConnection | undefined) => {
    const [msg, setMsg] = useState("")
    const [script, setScript] = useState('');
    const { finalTranscript } = useSpeechRecognition({
        clearTranscriptOnListen: true,
    });

    SpeechRecognition.startListening({ continuous: true, language: "ko-KR" });

    useEffect(() => {
        setScript(finalTranscript)
        VOICE_SCRIPT(finalTranscript.slice(script.length))
    }, [finalTranscript])

    useEffect(() => {
        sendLog()
    }, [VOICE_SCRIPT()])

    const handleKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            sendBtn()
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target
        setMsg(value)
    }

    useEffect(() => {
        const chatLog = document.getElementById('chatlog') as HTMLDivElement
        if (socket !== undefined) {

            socket.on('default_name', function (name) {
                // userName.value = name;
                USER_NAME(name)
            });

            // users change notice
            socket.on("notice", (data) => {
                let div = document.createElement("div");
                div.classList.add("notice");
                div.innerText = data;
                chatLog.appendChild(div);
                chatLog.scrollTop = chatLog.scrollHeight;
            });

            socket.on("newMsg", (data) => {
                let div_container = document.createElement("div");
                // let span = document.createElement("span");
                // span.innerText = data.msgTime;
                div_container.innerHTML = `<p>${data.msg.myMsg}</p>`;
                if (USER_NAME() === data.msg.myName) {
                    data.msg.type === "voice" ? div_container.classList.add("my-text", "my-voice-text") : div_container.classList.add("my-text")
                } else {
                    data.msg.type === "voice" ? div_container.classList.add("other-text", "other-voice-text") : div_container.classList.add("other-text")
                }
                // USER_NAME() === data.msg.myName ? div_container.classList.add("my-text") : div_container.classList.add("other-text");
                chatLog.appendChild(div_container);
                chatLog.scrollTop = chatLog.scrollHeight;
            });
        }
    }, [])

    // 채팅창 입력 후 전송 버튼
    function sendBtn() {
        if (msg === "") {
            alert("Please type your message");
            return false;
        } else {
            let myMsg = msg;
            let myName = USER_NAME();
            let type = "chat"
            let data = { myName, myMsg, type };
            socket !== undefined && socket.emit("sendMsg", data);
            setMsg("");
        }
    }
    // 음성 로그 전송 함수
    function sendLog() {
        if (script !== "") {
            let myMsg = VOICE_SCRIPT();
            let myName = USER_NAME();
            let type = "voice"
            let data = { myName, myMsg, type };
            socket !== undefined && socket.emit("sendMsg", data);
        }
    }
    // useEffect(() => {
    //     if (peerConnection !== undefined) {
    //         const dataChannelOptions = {
    //             ordered: false, // do not guarantee order
    //             maxPacketLifeTime: 3000, // in milliseconds
    //         };
    //         let dataChannel = peerConnection.createDataChannel("chatLog", dataChannelOptions)

    //         console.log(dataChannel)

    //         console.log()
    //         dataChannel.onerror = (error) => {
    //             console.log("Data Channel Error:", error);
    //         };

    //         dataChannel.onmessage = (event) => {
    //             console.log("Got Data Channel Message:", event.data);
    //         };

    //         dataChannel.onopen = () => {
    //             dataChannel.send("Hello World CHANNEL CONNECTED!!!!!");
    //         };

    //         dataChannel.onclose = () => {
    //             console.log("The Data Channel is Closed");
    //         };
    //     }
    // }, [peerConnection])



    return (

        <div className="chatlog-container">
            <div id="chatlog" className="chatlog"></div>
            <div className='chat-input-container'>
                <div id={"username"} className="input_box">{USER_NAME()}</div>
                <input type="text" id={"msg-input"} className="input_box" placeholder="Type here..." value={msg} onKeyDown={(e) => handleKeydown(e)} onChange={(e) => handleChange(e)} />
                <button type="submit" id={"send_btn"} className="input_btn" onClick={sendBtn}>Send</button>
            </div>
        </div>
    )
}