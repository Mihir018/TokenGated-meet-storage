import React, { useRef } from 'react';
import { ethers } from 'ethers';
import lighthouse from '@lighthouse-web3/sdk';

import { useEventListener, useHuddle01 } from '@huddle01/react';
import { Audio, Video } from '@huddle01/react/components';
/* Uncomment to see the Xstate Inspector */
// import { Inspect } from '@huddle01/react/components';

import {
  useAudio,
  useLobby,
  useMeetingMachine,
  usePeers,
  useRoom,
  useVideo,
  useRecording,
} from '@huddle01/react/hooks';

import Button from '../components/Button';

export default function Home() {
  const videoRef = useRef(null);
  const [cid, setCid] = React.useState(null)
  const [status, setStatus] = React.useState(null)
  const [fileURL, setFileURL] = React.useState(null);

  const { state, send } = useMeetingMachine();
  // Event Listner
  useEventListener('lobby:cam-on', () => {
    if (state.context.camStream && videoRef.current)
      videoRef.current.srcObject = state.context.camStream;
  });

  const { initialize, isInitialized } = useHuddle01();
  const { joinLobby } = useLobby();
  const {
    fetchAudioStream,
    produceAudio,
    stopAudioStream,
    stopProducingAudio,
    stream: micStream,
  } = useAudio();
  const {
    fetchVideoStream,
    produceVideo,
    stopVideoStream,
    stopProducingVideo,
    stream: camStream,
  } = useVideo();

  const { joinRoom, leaveRoom } = useRoom();
  const roomId = 'hub-qcpf-szd';

  const { peers } = usePeers();

  const { startRecording, stopRecording, isStarting, inProgress, isStopping, error, data: recordingData, } = useRecording();

  const encryptionSignature = async() =>{
    const provider = ((window.ethereum != null) ? new ethers.providers.Web3Provider(window.ethereum) : ethers.providers.getDefaultProvider());
    await provider.send('eth_requestAccounts', []);
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    const messageRequested = (await lighthouse.getAuthMessage(address)).data.message;
    const signedMessage = await signer.signMessage(messageRequested);
    return({
      signedMessage: signedMessage,
      publicKey: address
    });
  }

  const progressCallback = (progressData) => {
    let percentageDone =
      100 - (progressData?.total / progressData?.uploaded)?.toFixed(2);
    console.log(percentageDone);
  };

  /* Deploy file along with encryption */
  const uploadFileEncrypted = async(e) =>{
    /*
       uploadEncrypted(e, accessToken, publicKey, signedMessage, uploadProgressCallback)
       - e: js event
       - accessToken: your API key
       - publicKey: wallets public key
       - signedMessage: message signed by the owner of publicKey
       - uploadProgressCallback: function to get progress (optional)
    */
    const sig = await encryptionSignature();
    const response = await lighthouse.uploadEncrypted(
      e,
      "ed56b241.ea80f3ad590a41fc8987eb14752446ae", // add api key here
      sig.publicKey,
      sig.signedMessage,
      progressCallback
    );
    console.log(response);
    setCid(response.data.Hash);
    /*
      output:
        data: {
          Name: "c04b017b6b9d1c189e15e6559aeb3ca8.png",
          Size: "318557",
          Hash: "QmcuuAtmYqbPYmPx3vhJvPDi61zMxYvJbfENMjBQjq7aM3"
        }
      Note: Hash in response is CID.
    */
  }

  const applyAccessConditions = async(e) =>{
    // CID on which you are applying encryption
    // CID is generated by uploading a file with encryption
    // Only the owner of the file can apply access conditions
    // const cid = "";

    // Conditions to add
    const conditions = [
      {
        id: 1,
        chain: "Polygon",
        method: "getBalance",
        standardContractType: "",
        returnValueTest: {
            comparator: ">=",
            value: "1000000000000000000"
        }
      },
    ];

    // Aggregator is what kind of operation to apply to access conditions
    // Suppose there are two conditions then you can apply ([1] and [2]), ([1] or [2]), !([1] and [2]).
    const aggregator = "([1])";
    const {publicKey, signedMessage} = await encryptionSignature();

    /*
      accessCondition(publicKey, cid, signedMessage, conditions, aggregator)
        Parameters:
          publicKey: owners public key
          CID: CID of the file to decrypt
          signedMessage: message signed by the owner of publicKey
          conditions: should be in a format like above
          aggregator: aggregator to apply conditions
    */
    const response = await lighthouse.applyAccessCondition(
      publicKey,
      cid,
      signedMessage,
      conditions,
      aggregator
    );

    console.log(response);
    setCid(response.data.status);
    /*
      {
        data: {
          cid: "QmZkEMF5y5Pq3n291fG45oyrmX8bwRh319MYvj7V4W4tNh",
          status: "Success"
        }
      }
    */
  }

  const decrypt = async() =>{
    // Fetch file encryption key
    const cid = "QmR54spknUPfTfrCRHVC9ABYkPRehqnPJHWg9QPadqoVr5"; //replace with your IPFS CID
    const {publicKey, signedMessage} = await encryptionSignature();
    /*
      fetchEncryptionKey(cid, publicKey, signedMessage)
        Parameters:
          CID: CID of the file to decrypt
          publicKey: public key of the user who has access to file or owner
          signedMessage: message signed by the owner of publicKey
    */
    const keyObject = await lighthouse.fetchEncryptionKey(
      cid,
      publicKey,
      signedMessage
    );

    // Decrypt file
    /*
      decryptFile(cid, key, mimeType)
        Parameters:
          CID: CID of the file to decrypt
          key: the key to decrypt the file
          mimeType: default null, mime type of file
    */
   
    const fileType = "video/webm";
    const decrypted = await lighthouse.decryptFile(cid, keyObject.data.key, fileType);
    console.log(decrypted)
    /*
      Response: blob
    */

    // View File
    const url = URL.createObjectURL(decrypted);
    console.log(url);
    setFileURL(url);
  }

  return (
    <div className="grid grid-cols-1">
      <div>
        <h1 className="text-6xl font-bold">
          <center>Record the meet</center>
        </h1>

        {/* <h2 className="text-2xl">Room State</h2>
        <h3>{JSON.stringify(state.value)}</h3>

        <h2 className="text-2xl">Me Id</h2>
        <div className="break-words">
          {JSON.stringify(state.context.peerId)}
        </div>
        <h2 className="text-2xl">Consumers</h2>
        <div className="break-words">
          {JSON.stringify(state.context.consumers)}
        </div>

        <h2 className="text-2xl">Error</h2>
        <div className="break-words text-red-500">
          {JSON.stringify(state.context.error)}
        </div>
        <h2 className="text-2xl">Peers</h2>
        <div className="break-words">{JSON.stringify(peers)}</div>
        <h2 className="text-2xl">Consumers</h2>
        <div className="break-words">
          {JSON.stringify(state.context.consumers)}
        </div> */}

        {/* <h2 className="text-3xl text-blue-500 font-extrabold">Idle</h2> */}
        <div className="flex gap-4 flex-wrap">
        <Button
          disabled={!state.matches('Idle')}
          onClick={() => initialize('KL1r3E1yHfcrRbXsT4mcE-3mK60Yc3YR')}
        >
          INIT
        </Button>

        <br />
        <br />
        {/* <h2 className="text-3xl text-red-500 font-extrabold">Initialized</h2> */}
        <Button
          disabled={!joinLobby.isCallable}
          onClick={() => {
            joinLobby('hub-qcpf-szd');
          }}
        >
          JOIN_LOBBY
        </Button>
        </div>
        <br />
        <br />
        <h2 className="text-3xl text-yellow-500 font-extrabold">Lobby</h2>
        <div className="flex gap-4 flex-wrap">
          <Button
            disabled={!fetchVideoStream.isCallable}
            onClick={fetchVideoStream}
          >
            FETCH_VIDEO_STREAM
          </Button>

          <Button
            disabled={!fetchAudioStream.isCallable}
            onClick={fetchAudioStream}
          >
            FETCH_AUDIO_STREAM
          </Button>

          <Button disabled={!joinRoom.isCallable} onClick={joinRoom}>
            JOIN_ROOM
          </Button>

          <Button
            disabled={!state.matches('Initialized.JoinedLobby')}
            onClick={() => send('LEAVE_LOBBY')}
          >
            LEAVE_LOBBY
          </Button>

          <Button
            disabled={!stopVideoStream.isCallable}
            onClick={stopVideoStream}
          >
            STOP_VIDEO_STREAM
          </Button>
          <Button
            disabled={!stopAudioStream.isCallable}
            onClick={stopAudioStream}
          >
            STOP_AUDIO_STREAM
          </Button>
        </div>
        <br />
        <div>
        Player:
        <video ref={videoRef} autoPlay muted></video>
        <div className="grid grid-cols-4">
          {Object.values(peers)
            .filter(peer => peer.cam)
            .map(peer => (
              <Video
                key={peer.peerId}
                peerId={peer.peerId}
                track={peer.cam}
                debug
              />
            ))}
          {Object.values(peers)
            .filter(peer => peer.mic)
            .map(peer => (
              <Audio key={peer.peerId} peerId={peer.peerId} track={peer.mic} />
            ))}
        </div>
      </div>
        <h2 className="text-3xl text-green-600 font-extrabold">Room</h2>
        <div className="flex gap-4 flex-wrap">
          <Button
            disabled={!produceAudio.isCallable}
            onClick={() => produceAudio(micStream)}
          >
            PRODUCE_MIC
          </Button>

          <Button
            disabled={!produceVideo.isCallable}
            onClick={() => produceVideo(camStream)}
          >
            PRODUCE_CAM
          </Button>

          <Button
            disabled={!stopProducingAudio.isCallable}
            onClick={() => stopProducingAudio()}
          >
            STOP_PRODUCING_MIC
          </Button>

          <Button
            disabled={!stopProducingVideo.isCallable}
            onClick={() => stopProducingVideo()}
          >
            STOP_PRODUCING_CAM
          </Button>
          <Button
            disabled={!startRecording.isCallable}
            onClick={() =>
              startRecording(`${window.location.href}rec/${roomId}`)
            }
          >
            {`START_RECORDING error: ${error}`}
          </Button>
          <Button disabled={!stopRecording.isCallable} onClick={stopRecording}>
            STOP_RECORDING
          </Button>

          <Button disabled={!leaveRoom.isCallable} onClick={leaveRoom}>
            LEAVE_ROOM
          </Button>
        </div>
        <br></br>
        <br></br>
        <h2 className="text-2xl">Recording Data</h2>
        <div className="break-words">{JSON.stringify(recordingData)}</div>

        {/* Uncomment to see the Xstate Inspector */}
        {/* <Inspect /> */}
      </div>
      
      <div style={{margin: 30 + 'px'}}>
        <h1 className="text-6xl font-bold">
          <center>Token-Gate the Recording</center>
        </h1>
        <br></br>
        {/* <div className="file-input">
          <input onChange={e=>uploadFileEncrypted(e)} type="file" id="file" class="file" />
          <label for="file">
            Select file
          <p class="file-name"></p>
          </label>
        </div> */}
        <div className='container'>
        <div className='container'>
        <input onChange={e=>uploadFileEncrypted(e)} type="file" name="file" id="file" class="inputfile" />
        <label for="file">Choose a file</label>
        <h3>Uploaded File Details</h3>
        <p>CID:{cid}</p>
        <div style={{marginTop: 100 + 'px'}}>
          <button className='button2' onClick={()=>{applyAccessConditions()}}>Apply Access Conditions</button>
          <br />
          <br />
          <p>Status:{status}</p>  
          {
            <p>Visit at: https://files.lighthouse.storage/viewFile/{cid}</p>
          }
          <br />
          <br />
          <button className='button2' onClick={()=>decrypt()}>Decrypt the content</button>
          </div>
          {
            fileURL?
            <a href={fileURL} target="_blank">viewFile</a>
            :
            null
          }
          </div>
        </div>
      </div>
    </div>
  );
}
