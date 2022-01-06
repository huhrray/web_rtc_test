export const VideoContainer = (localVideoRef: any, remoteVideoRef: any) => {


  return (
    <div className="video-container">
      <video
        muted
        ref={localVideoRef}
        autoPlay
      />
      <video
        id="remotevideo"
        ref={remoteVideoRef}
        autoPlay
      />
    </div >
  );
};
