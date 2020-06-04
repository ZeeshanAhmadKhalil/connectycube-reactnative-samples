import { Platform, ToastAndroid } from 'react-native';
import Toast from 'react-native-simple-toast';
import ConnectyCube from 'react-native-connectycube';
import InCallManager from 'react-native-incall-manager';
import Sound from 'react-native-sound';
import { users } from '../config';

export default class CallService {
  participantIds = [];

  static MEDIA_OPTIONS = { audio: true, video: { facingMode: 'user' } };
  static CURRENT_USER = null;

  _session = null;
  mediaDevices = [];


  outgoingCall = new Sound(require('../../assets/sounds/dialing.mp3'));
  incomingCall = new Sound(require('../../assets/sounds/calling.mp3'));
  endCall = new Sound(require('../../assets/sounds/end_call.mp3'));

  showToast = text => {
    const commonToast = Platform.OS === 'android' ? ToastAndroid : Toast;
    commonToast.showWithGravity(text, Toast.LONG, Toast.TOP);
  };

  getUserById = (userId, key) => {
    const user = users.find(user => user.id == userId);
    if (typeof key === 'string') {
      return user[key];
    }
    return user;
  };


  startCall = (ids) => {
    const opponents = [];

    ids.forEach(id => {
      const userInfo = this.getUserById(id)
      opponents.push(userInfo.id, userInfo.name);
    })
    this.participantIds = ids
    this.janusRoomId = this._getUniqueRoomId()
    this.sendIncomingCallSystemMessage(ids)
    this.playSound('outgoing')
    this.initiatorID = this.currentUserID
    // this.startNoAnswerTimers(this.participantIds)
    this.joinConf(this.janusRoomId)
    // this.startNoAnswerTimers(this.participantIds)
  };

  joinConf = (janusRoomId, retry) => {
    this._session = ConnectyCube.videochatconference.createNewSession()
    return this._session.getUserMedia(CallService.MEDIA_OPTIONS).then(stream => {
      this._session.join(janusRoomId, this.currentUserID, this.currentUserName);
    }, error => {
      console.warn('[Get user media error]', error, this.mediaParam)
      if (!retry) {
        this.mediaParams.video = false
        return this.joinConf(janusRoomId, true)
      }
    });
  }

  onSystemMessage = (msg, showInomingCallModal, hideInomingCallModal) => {
    console.warn('[onSystemMessage]', msg)
    const { extension, userId } = msg
    if (extension.callStart) {
      const { participantIds, janusRoomId } = extension
      this.playSound('incoming');
      const oponentIds = participantIds
        .split(',')
        .map(user_id => +user_id)
        .filter(user_id => user_id != this.currentUserID)
      if (this.janusRoomId) {
        return this.sendRejectCallMessage([...oponentIds, userId], janusRoomId, true)
      }
      this.janusRoomId = janusRoomId
      this.initiatorID = userId
      this.participantIds = oponentIds
      showInomingCallModal();
    } else if (extension.callRejected) {
      const { janusRoomId } = extension
      if (this.janusRoomId === janusRoomId) {
        const { busy } = extension
        this.onRejectCallListener(this._session, userId, { busy })
      }
    } else if (extension.callEnd) {
      const { janusRoomId } = extension
      if (this.janusRoomId === janusRoomId) {
        this.onStopCallListener(this._session, userId)
      }
    }
  }

  acceptCall = () => {
    this.stopSounds();
    this.setMediaDevices();
    this._session = ConnectyCube.videochatconference.createNewSession()
    return this._session.getUserMedia(CallService.MEDIA_OPTIONS).then(stream => {
      this._session.join(this.janusRoomId, CallService.CURRENT_USER.id, CallService.CURRENT_USER.name);
      return stream;
    })
  };

  setMediaDevices() {
    return ConnectyCube.videochatconference.getMediaDevices().then(mediaDevices => {
      this.mediaDevices = mediaDevices;
    });
  }

  _getUniqueRoomId() {
    return ConnectyCube.chat.helpers.getBsonObjectId()
  }

  sendIncomingCallSystemMessage = (participantIds) => {
    const msg = {
      extension: {
        callStart: '1',
        janusRoomId: this.janusRoomId,
        participantIds: participantIds.join(','),
      }
    }
    return participantIds.map(user_id => ConnectyCube.chat.sendSystemMessage(user_id, msg))
  }

  playSound = type => {
    switch (type) {
      case 'outgoing':
        this.outgoingCall.setNumberOfLoops(-1);
        this.outgoingCall.play();
        break;
      case 'incoming':
        this.incomingCall.setNumberOfLoops(-1);
        this.incomingCall.play();
        break;
      case 'end':
        this.endCall.play();
        break;

      default:
        break;
    }
  };

  stopSounds = () => {
    if (this.incomingCall.isPlaying()) {
      this.incomingCall.pause();
    }
    if (this.outgoingCall.isPlaying()) {
      this.outgoingCall.pause();
    }
  };

  processOnRemoteStreamListener = () => {
    return new Promise((resolve, reject) => {
      if (!this._session) {
        reject();
      } else {
        resolve();
      }
    });
  };


  // processOnRejectCallListener(session, userId, extension = {}) {
  //   return new Promise((resolve, reject) => {
  //     if (userId === session.currentUserID) {
  //       this._session = null;
  //       this.showToast('You have rejected the call on other side');

  //       reject();
  //     } else {
  //       const userName = this.getUserById(userId, 'name');
  //       const message = extension.busy
  //         ? `${userName} is busy`
  //         : `${userName} rejected the call request`;

  //       this.showToast(message);

  //       resolve();
  //     }
  //   });
  // }



  // setMediaDevices() {
  //   return ConnectyCube.videochat.getMediaDevices().then(mediaDevices => {
  //     this.mediaDevices = mediaDevices;
  //   });
  // }

  // acceptCall = session => {
  //   this.stopSounds();
  //   this._session = session;
  //   this.setMediaDevices();

  //   return this._session
  //     .getUserMedia(CallService.MEDIA_OPTIONS)
  //     .then(stream => {
  //       this._session.accept({});
  //       return stream;
  //     });
  // };

  // stopCall = () => {
  //   this.stopSounds();

  //   if (this._session) {
  //     this.playSound('end');
  //     this._session.stop({});
  //     ConnectyCube.videochat.clearSession(this._session.ID);
  //     this._session = null;
  //     this.mediaDevices = [];
  //   }
  // };

  // rejectCall = (session, extension) => {
  //   this.stopSounds();
  //   session.reject(extension);
  // };

  // setAudioMuteState = mute => {
  //   if (mute) {
  //     this._session.mute('audio');
  //   } else {
  //     this._session.unmute('audio');
  //   }
  // };

  // switchCamera = localStream => {
  //   localStream.getVideoTracks().forEach(track => track._switchCamera());
  // };

  // setSpeakerphoneOn = flag => InCallManager.setSpeakerphoneOn(flag);

  // processOnUserNotAnswerListener(userId) {
  //   return new Promise((resolve, reject) => {
  //     if (!this._session) {
  //       reject();
  //     } else {
  //       const userName = this.getUserById(userId, 'name');
  //       const message = `${userName} did not answer`;

  //       this.showToast(message);

  //       resolve();
  //     }
  //   });
  // }

  // processOnCallListener(session) {
  //   return new Promise((resolve, reject) => {
  //     if (session.initiatorID === session.currentUserID) {
  //       reject();
  //     }

  //     if (this._session) {
  //       this.rejectCall(session, {busy: true});
  //       reject();
  //     }

  //     this.playSound('incoming');

  //     resolve();
  //   });
  // }

  // processOnAcceptCallListener(session, userId, extension = {}) {
  //   return new Promise((resolve, reject) => {
  //     if (userId === session.currentUserID) {
  //       this._session = null;
  //       this.showToast('You have accepted the call on other side');

  //       reject();
  //     } else {
  //       const userName = this.getUserById(userId, 'name');
  //       const message = `${userName} has accepted the call`;

  //       this.showToast(message);
  //       this.stopSounds();

  //       resolve();
  //     }
  //   });
  // }

  // processOnRejectCallListener(session, userId, extension = {}) {
  //   return new Promise((resolve, reject) => {
  //     if (userId === session.currentUserID) {
  //       this._session = null;
  //       this.showToast('You have rejected the call on other side');

  //       reject();
  //     } else {
  //       const userName = this.getUserById(userId, 'name');
  //       const message = extension.busy
  //         ? `${userName} is busy`
  //         : `${userName} rejected the call request`;

  //       this.showToast(message);

  //       resolve();
  //     }
  //   });
  // }

  // processOnStopCallListener(userId, isInitiator) {
  //   return new Promise((resolve, reject) => {
  //     this.stopSounds();

  //     if (!this._session) {
  //       reject();
  //     } else {
  //       const userName = this.getUserById(userId, 'name');
  //       const message = `${userName} has ${
  //         isInitiator ? 'stopped' : 'left'
  //       } the call`;

  //       this.showToast(message);

  //       resolve();
  //     }
  //   });
  // }


}
