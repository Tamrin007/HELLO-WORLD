export default class roomController {

  /*
  classのコンストラクタ
  $scope,$http,$stateParams,$stateはこのroomControllerで使うためにinjectする必要のなるものであり、
  詳細はAngularJSを参照すること。
  */
  constructor($scope,$http,$stateParams,$state) {
    //ブラウザでカメラとマイクを使用するために必要なコードライン
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    //おすすめサイトの名前を正しくstringに直すためにこの関数を具現した。
    String.prototype.unescapeHtml = function(){
        return this.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "\'");
    };

    //必要となる変数などをここで定義
    this.$scope = $scope;
    this.$http = $http;
    this.$stateParams = $stateParams;
    this.$state = $state;

    //定期同期化される必要があるかどうか
    this.needSync = true;

    //現在のmember数
    this.roomMember = 1;
    
    /*
    room stateでroomNameを決めてきていたらそれがroomKeyとなる。
    もし、そうでないのなら、urlからroomKeyを読み取る。
    main.jsを見ればわかるように、routing ruleにより、こうすることでroomKeyは得られる。
    */
    this.roomName = ($scope.rootCtrl.roomName) ? $scope.rootCtrl.roomName: $stateParams.roomKey;
    //現在書いているコードの情報
    this.name = "new file";
    //選択可能な言語モードの情報
    this.modes = [
      {"lang" : "javascript", "ex" : "js"},
      {"lang" : "python", "ex" : "py"},
      {"lang" : "ruby", "ex" : "rb"}
    ];
    //選択された言語モードの情報
    this.mode = this.modes[0];
    //選択可能なテーマの情報
    this.themes = ["midnight","neo","eclipse"];
    //選択されたテーマの情報
    this.theme = this.themes[0];

    //editor with ace
    this.editor = ace.edit("editor");
    // API 経由で内容を変更した際のアラートを黙らせます
    this.editor.$blockScrolling = Infinity;
    this.editor.setTheme("ace/theme/monokai");
    this.onkeyup = ()=>{
      console.log("onkeyup event")
      this.isFromMe = true;
    };
    this.editor.on("paste",()=>{
      console.log("paste event")
      this.isFromMe = true;
    });

    this.editor.getSession().on("change",(event)=>{
      if(this.isFromMe){
        console.log("send event : ",event)
        this.room.send({
          "name" : this.name,
          "theme" : this.theme,
          "mode" : this.mode,
          "event" : event
        });
      }else{
        console.log("other wrote something")
      }
    });

    //このpeerが通信を可能とするオブジェクト
    this.peer = new Peer({
      //Api key(KIM GEE WOOK)
      key: '91f325de-7cf5-4036-be2b-8ebd0a5a5e17'
    });
    // peerにつながったらopenというイベントが発生し、(id)=>{...}と書かれているcallback関数が実行される。
    // もしこのCallback関数のことがわからないのなら、JSのことの勉強をすること。
    this.peer.on('open', (id) => {
      /*
      以下はaudioとvideoをstreamにして、
      angular.elementでclassがvideoであるroom.htmlでのdivに(room.htmlを確認すること。)
      '<video id="video_' + myPeerId + '" class="videoBox" width="300" height="200" autoplay="autoplay" class="remoteVideos" src="' + streamURL + '" > </video> <br>'
      このvideoタグを入れている。
      そして実行してみてdivの中に要素が追加されることが確認できる。
      */
      navigator.getUserMedia(
        {audio: true, video: true},
        (stream) => {
            // Set your video displays
            window.localStream = stream;
            var streamURL = URL.createObjectURL(stream);
            var peerId = id;
            //このvideo-wrapperで大きさの調整ができる
            angular.element('#video-wrapper')[0].style.width = "255px";

            angular.element('.videos').append(
                '<div class="videoBox"><video id="video_' + peerId + '" class="remoteVideos" width="100%" autoplay="autoplay" src="' + streamURL + '" > </video></div>'
            );
            /*
            自分のvideoを表示できてから、roomに入る準備をする。
            ここでthis.roomNameが入ろうとするroomを特定するkeyとなる。
            */
            console.log(this.roomName,"に接続します");
            this.room = this.peer.joinRoom(this.roomName, {mode: 'sfu', stream: stream});
            // 他のmemberのstreamを管理
            this.room.on('stream', (stream) =>{
              //console.log("add other stream",stream);
              var streamURL = URL.createObjectURL(stream);
              var peerId = stream.peerId;
              this.$scope.$apply(()=>{
                this.roomMember++;
              });
              //div class="video"の中にvideoをappendしていく。
              angular.element('.videos').append(
                '<div class="videoBox"><video id="video_' + peerId + '" class="remoteVideos" width="100%" autoplay="autoplay" src="' + streamURL + '" > </video></div>'
            );
            });

            //他のmemberがroomから離れる時は該当するvideoタグを除去
            this.room.on('removeStream', (stream) => {
              //console.log("remove other stream",stream)
              this.$scope.$apply(()=>{
                this.roomMember--;
              });
              angular.element('#video_' + stream.peerId).remove();
            });

            this.room.on('data', (data) => {
              console.log(data.src + "からもらったデータ：",data)
              this.isFromMe = false;
              this.mode = (data.data.mode) ? data.data.mode: this.mode;
              this.theme = (data.data.theme) ? data.data.theme: this.theme;
              this.name = (data.data.name) ? data.data.name: this.name;
              if(data.data.content && this.needSync){
                console.log("Sync now");
                this.editor.setValue(data.data.content);
                this.needSync = false;
              }
              if(data.data.event){
                console.log("receive event from other");
                if(data.data.event.action === "insert"){
                  console.log("insert event")
                  this.editor.getSession().getDocument().insertMergedLines(data.data.event.start, data.data.event.lines);
                } else if(data.data.event.action === "remove"){
                  console.log("remove event")
                  this.editor.getSession().getDocument().remove(data.data.event);
                }
              }
            });

            this.room.on('peerJoin', (peerId) => {
              console.log(peerId + 'has joined the room');
              //新たなユーザが入ってきたらcode, theme, modeを共有
              this.isFromMe = true;
              this.needSync = false;
              this.room.send({
                "name" : this.name,
                "content" : this.editor.getValue(),
                "theme" : this.theme,
                "mode" : this.mode
              });
            });

            this.room.on('peerLeave', (peerId) => {
              console.log(peerId + 'has left the room');
            });

            this.room.on('error', function(err) { 
              console.log("error : ",err);
            });
        },
        (e) => {
          console.error("error",e);
        }
      );
    });

    //アプリから抜ける時にcうあんと接続関連して、綺麗に片付けるためのコードライン
    window.onunload = window.onbeforeunload = (e) => {
      if (!!this.peer && !this.peer.destroyed) {
        this.peer.destroy();
      }
    };

  };

  //file load機能
  showContent($fileContent){
    //自分が入力するものだから
    this.isFromMe = true;
    this.name = $fileContent.name;
    this.editor.setValue($fileContent.content);
  };

  //コード実行機能
  run(){
    //http post
    return this.$http.post("https://hello-world.moe/exec",JSON.stringify({
      "language" : this.mode.lang,
      "code" :  this.editor.getValue()
    }))
    .then((response) => {
      //responseをもらう
      console.log("response : ",response);
      this.searchResult = 0;
      this.result = response.data;

      //もしエラーが返ってきたら
      if(this.result.is_error){
        //search機能実行
        this.search({
          "language" : this.mode.lang,
          "code" :  this.editor.getValue(),
          "output" : this.result.output
        });
      }
    });
  };

  //search apiを呼ぶ
  search(query){
    console.log("search now!")
    //http post
    return this.$http.post("https://hello-world.moe/search",JSON.stringify(query))
    .then((response) => {
      console.log("search response : ",response);
      this.searchResult = {
        "title" : response.data.title.unescapeHtml(),
        "url" : response.data.url
      };
    });
  }

  //save機能
  save(){
    var link = document.createElement('a');
    link.download = this.name + '.' +this.mode.ex; //filename
    link.href = 'data:text,\uFEFF' + escape(this.editor.getValue()); //content
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  modeChange(){
    this.room.send({
      "mode" : this.mode
    })
  };

  themeChange(){
    this.room.send({
      "theme" : this.theme
    })
  }


  //以下のコードは参考用で残すけどもう使わない

  /*
  この関数は自分以外のユーザがコードを書いた時にそれを自分のeditorに適切に反映させる関数
  アルゴリズムの説明(user other, meを仮定)
  １。otherのcursorとmeのcursorが一緒の位置であったのならotherが変更を加えた後にも彼らのcursorは一緒である。
  ２。otherのcursorが前にあったら、meの現在のカーサの位置からstringの終わりまでを切って、保管しておく(behindstring)。
    そして、変更されたstringから後ろから見て、behindstringと重なる範囲でできるだけ前の位置にmeのカーサをおけばOK
  ３。ここothermpカーサが後ろであった場合であり、２。の逆の方法で良い
  */
  // codeUpdate(data){
  //   console.log("code update")
  //   this.$scope.$apply(() => {
  //     /*
  //       this.code.contentとdataをうまく比較してrememberから修正を加えて、cursorの位置を更新
  //     */
  //     this.pastCursor = angular.element('.CodeMirror')[0].CodeMirror.getDoc().getCursor()
  //     this.newCursor = this.pastCursor;
  //     console.log("アップデートの前のstring : ",this.code.content);
  //     console.log("otherのアップデート前のカーサ, meのアップデート前のカーサ : ",data.pastCursor,this.newCursor);

  //     if((data.pastCursor.line == this.newCursor.line) && (data.pastCursor.ch == this.newCursor.ch)){
  //       console.log("#other.pastcursor == me.pastcursor#")
  //       //変更の前にお互いのカーサーの位置が一緒の場合にはそのまま追いかければ良い。
  //       this.newCursor = data.newCursor;
  //     }else if(data.pastCursor.line < this.newCursor.line || ((data.pastCursor.line == this.newCursor.line) && (data.pastCursor.ch < this.newCursor.ch))){
  //       console.log("#other.pastcursor < me.pastcursor#")
  //       //相手のカーサーが前にあった場合
  //       var behindString = this.code.content.slice(this.cursorIndex(this.code.content,this.pastCursor));
  //       console.log("behindString",behindString);
  //       var duplicated_length = 0;
  //       for(var i = 0;i < behindString.length;i++){
  //         if(data.newString[data.newString.length - i - 1] != behindString[behindString.length - i - 1]){
  //           break;
  //         }else{
  //           duplicated_length++;
  //         }
  //       };
  //       console.log("duplicated_length",duplicated_length);
  //       this.newCursor = this.indexCursor(data.newString, data.newString.length - duplicated_length);
  //     }else{
  //       console.log("#other.pastcursor > me.pastcursor#")
  //       var beforeString = this.code.content.slice(0,this.cursorIndex(this.code.content,angular.element('.CodeMirror')[0].CodeMirror.getDoc().getCursor()));
  //       console.log("beforeString",beforeString);
  //       var duplicated_length = 0;
  //       for(var i = 0;i < beforeString.length;i++){
  //         if(data.newString[i] != beforeString[i]){
  //           break;
  //         }else{
  //           duplicated_length++;
  //         }
  //       };
  //       console.log("duplicated_length",duplicated_length);
  //       this.newCursor = this.indexCursor(data.newString, duplicated_length);
  //     };
  //     this.code.content = data.newString;
  //   });

  //   angular.element('.CodeMirror')[0].CodeMirror.focus();
  //   angular.element('.CodeMirror')[0].CodeMirror.getDoc().setCursor(this.newCursor);
  //   console.log("newCursor position",this.newCursor);
  // };

  // indexCursor(string,index){
  //   //console.log("indexCursor function with string : ",string," index : ",index);
  //   var beforeCursor = string.slice(0,index);
  //   //console.log("beforeCursor string : ",beforeCursor);
  //   var lines = beforeCursor.split("\n");
  //   console.log("indexCursor関数の結果です。string,index,result順")
  //   console.log(string,index,{
  //     "line" : lines.length-1,
  //     "ch" : lines[lines.length-1].length
  //   });
  //   return {
  //     "line" : lines.length-1,
  //     "ch" : lines[lines.length-1].length
  //   };
  // };

  // cursorIndex(string,cursor){
  //   var lines = string.split("\n");
  //   var result = 0;
  //   for(var i = 0;i < cursor.line;i++,result++){
  //     result+=lines[i].length;
  //   };
  //   result+=cursor.ch;
  //   console.log("cursorIndex関数の結果です。string,cursor,result順")
  //   console.log(string,cursor,result);
  //   return result;
  // };

};