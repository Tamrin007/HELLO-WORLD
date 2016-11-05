export default class roomController {
  constructor($scope,$http,jsDiff) {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    this.$scope = $scope;
    this.$http = $http;
    this.jsDiff = jsDiff;
    this.roomName = $scope.rootCtrl.roomName;
    this.code = {
      "name" : "new file",
      "content" : ""
    };
    this.modes = [
      {"lang" : "javascript", "ex" : "js"},
      {"lang" : "python", "ex" : "py"},
      {"lang" : "ruby", "ex" : "rb"}
    ];
    this.themes = ["midnight","neo","eclipse"];
    this.theme = this.themes[0];
    this.mode = this.modes[0];
    this.editorOptions = {
        lineWrapping : true,
        lineNumbers: true,
        mode: this.mode.lang,
        theme: this.theme,
        extraKeys: {"Ctrl-Space":"autocomplete"}
    };
    this.former = "";
    // Connect to SkyWay, have server assign an ID instead of providing one
    // Showing off some of the configs available with SkyWay :).
    this.peer = new Peer({
      // Set API key for cloud server (you don't need this if you're running your
      // own.
      key: '91f325de-7cf5-4036-be2b-8ebd0a5a5e17'
    });
    // Show this peer's ID.
    this.peer.on('open', (id) => {
      console.log("peerはconnect")
      navigator.getUserMedia(
        {audio: true, video: false},
        (stream) => {
            // Set your video displays
            window.localStream = stream;
            console.log(this.roomName,"に接続します")
            this.room = this.peer.joinRoom(this.roomName, {mode: 'sfu', stream: stream});
            this.room.on('open', () => {
              this.connect();
            });
        },
        (e) => {
          console.error(e);
        }
      );
    });
    // Await connections from others
    this.peer.on('connection', this.connect);
    this.peer.on('error', (err) => {
      console.log(err);
    });

    // Make sure things clean up properly.
    window.onunload = window.onbeforeunload = (e) => {
      if (!!this.peer && !this.peer.destroyed) {
        this.peer.destroy();
      }
    };
  };

  update(data){
    var remember = angular.element('.CodeMirror')[0].CodeMirror.getDoc().getCursor()
    this.$scope.$apply(() => {
      //this.code.contentとdataをうまく比較してrememberから修正を加えて、cursorの位置を更新
      console.log("diff : ",jsDiff.diffChars(this.code.content,data));
      this.code.content = data;
    });
    angular.element('.CodeMirror')[0].CodeMirror.focus();
    angular.element('.CodeMirror')[0].CodeMirror.getDoc().setCursor(remember);
    console.log("remembered cursor position",remember);
  };

  setTofirst(){
    angular.element('.CodeMirror')[0].CodeMirror.focus();
    angular.element('.CodeMirror')[0].CodeMirror.getDoc().setCursor({line: 0, ch: 0})
  }
  getCursor(){
    angular.element('.CodeMirror')[0].CodeMirror.focus();
    console.log(angular.element('.CodeMirror')[0].CodeMirror.getDoc().getCursor());
  }

  settingChange(){
    console.log("setting Changed!");
    this.editorOptions = {
        lineWrapping : true,
        lineNumbers: true,
        mode: this.mode.lang,
        theme: this.theme
    };
  };

  // Handle a connection object.
  connect() {
    console.log("roomに参加できました。")

    this.room.on('data', (message) => {
      console.log(message.src + "からのデータ：",message)
      this.update(message.data);
    });

    this.room.on('peerJoin', (peerId) => {
      console.log(peerId + 'has joined the room');
    });

    this.room.on('peerLeave', (peerId) => {
      console.log(peerId + 'has left the room');
    });

    // Wait for stream on the call, then set peer video display
    this.room.on('stream', (stream) =>{
      const streamURL = URL.createObjectURL(stream);
      const peerId = stream.peerId;

      $('#their-audios').append($(
        '<div class="col-xs-8" id="control_' + peerId + '">' +
        '<div class="panel panel-primary">'+
        '<div class = "panel-heading">' +
          '<h3 id="label_' + peerId + '" class="panel-title">' + 'Student ID :' + stream.peerId + '</h3>' +
          '<audio autoplay="autoplay" class="remoteAudios" src="' + streamURL + '" id="audio_' + peerId + '">' +
        '</div>' +
        '<div class="panel-body">' +
          '<button onclick="document.getElementById('+"'"+'audio_' + peerId  +"'"+').play()" class="mdl-button mdl-js-button mdl-button--raised">Play</button>' +
          '<button onclick="document.getElementById('+"'"+'audio_' + peerId  +"'"+').pause()" class="mdl-button mdl-js-button mdl-button--raised">Pause</button>' +
          '<button onclick="document.getElementById('+"'"+'audio_' + peerId  +"'"+').volume+=0.1" class="mdl-button mdl-js-button mdl-button--raised">Volume Up</button>' +
          '<button onclick="document.getElementById('+"'"+'audio_' + peerId  +"'"+').volume-=0.1" class="mdl-button mdl-js-button mdl-button--raised">Volume Down</button>' +
        '</div>' +
        '</div>' +
        '</div>'
        ));
    });

    this.room.on('removeStream', (removedStream) => {
      $('#audio_' + removedStream.peerId).remove();
      $('#label_' + removedStream.peerId).remove();
      $('#control_' + removedStream.peerId).remove();
    });


  };

  showContent($fileContent){
    this.code.name = $fileContent.name;
    this.code.content = $fileContent.content;
    console.log("send code!");
    this.input();
  };

  run(type,data){
    console.log({
      "language" : type,
      "code" :  JSON.stringify(data).slice(1, -1)
    });
  };

  new(){
    this.code.name = "new file";
    this.code.content = "";
    this.input();
  };

  save(data){
    var link = document.createElement('a');
    link.download = "save."+this.mode.ex; //filename
    link.href = 'data:text,\uFEFF' + data; //content
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  input(){
    console.log("changed! send code!");
    console.log(angular.element('.CodeMirror')[0].CodeMirror);
    console.log(angular.element('.CodeMirror')[0].CodeMirror.getDoc().getCursor());
    this.room.send(this.code.content);
  };

};