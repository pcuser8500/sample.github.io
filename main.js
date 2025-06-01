const { nowInSec, SkyWayAuthToken, SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } = skyway_room;

window.onload = async function () {
    var Token = localStorage.getItem('Token');

    console.log(Token);
    if (Token != "") {
        console.log("Tokenをロードしました");
        await SkyWay_main(String(Token));
    } else {
        alert("認証情報を入力してください");
    }
}

async function IdKeySave() {
    const AppId = document.getElementById('App-id').value;
    const SecretKey = document.getElementById('Secret-key').value;
    var Token = document.getElementById('Token').value;

    if (AppId != "" && SecretKey != "") {
        Token = await SkyWay_MakeToken(AppId, SecretKey);
        await localStorage.setItem('Token', Token);
        console.log("保存済み");
        location.reload();
    } else {
        if (Token != "") {
            await localStorage.setItem('Token', Token);
            location.reload();
        } else {
            alert("認証情報を入力してください");
        }
    }
}

function SkyWay_MakeToken(AppId, SecretKey) {
    const token = new SkyWayAuthToken({
        jti: uuidV4(),
        iat: nowInSec(),
        exp: nowInSec() + 60 * 60 * 24 * 3,
        scope: {
            app: {
                id: AppId,
                turn: true,
                actions: ['read'],
                channels: [
                    {
                        id: '*',
                        name: '*',
                        actions: ['write'],
                        members: [
                            {
                                id: '*',
                                name: '*',
                                actions: ['write'],
                                publication: {
                                    actions: ['write'],
                                },
                                subscription: {
                                    actions: ['write'],
                                },
                            },
                        ],
                        sfuBots: [
                            {
                                actions: ['write'],
                                forwardings: [
                                    {
                                        actions: ['write'],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        },
    }).encode(SecretKey);
    return token;
}

function SkyWay_main(token) {
    const { nowInSec, SkyWayAuthToken, SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } = skyway_room;

    (async () => {
        const buttonArea = document.getElementById('button-area');
        const remoteMediaArea = document.getElementById('remote-media-area');
        const roomNameInput = "transceiver";

        var Members = 1;

        const myId = document.getElementById('my-id');
        const Memberselem = document.getElementById('Members');
        const IdDisp = document.getElementById('id-disp');
        const joinButton = document.getElementById('join');

        const target = document.getElementById('MuteInfo');
        const NonMutebtn = document.getElementById('NonMute-btn');

        const leavebtn = document.getElementById('leave');

        joinButton.onclick = async () => {
            // 通信容量削減のための低音質マイク設定
            const audio = await SkyWayStreamFactory.createMicrophoneAudioStream({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    codec: 'opus'
                }
            });

            if (roomNameInput === '') return;

            const context = await SkyWayContext.Create(token);
            const room = await SkyWayRoom.FindOrCreate(context, {
                type: 'p2p',
                name: roomNameInput,
            });
            const me = await room.join();

            const publication = await me.publish(audio);
            await publication.disable();
            target.textContent = "ミュート中";

            myId.textContent = me.id;
            Memberselem.textContent = Members + "人";
            IdDisp.style.visibility = "visible";

            NonMutebtn.style.visibility = "visible";
            NonMutebtn.style.opacity = 1;
            joinButton.style.visibility = "hidden";
            leavebtn.style.visibility = "visible";

            leavebtn.onclick = () => {
                me.leave();
                location.reload();
            };

            NonMutebtn.addEventListener('pointerdown', async () => {
                const intervalId = await setInterval(increment, 20)

                document.addEventListener('pointerup', async () => {
                    await clearInterval(intervalId);
                    await publication.disable();
                    target.textContent = "ミュート中";
                    NonMutebtn.style.backgroundColor = "rgb(147, 235, 235)";
                }, { once: true });
            });

            const increment = async () => {
                target.textContent = "ミュート解除中";
                NonMutebtn.style.backgroundColor = "red";
                await publication.enable();
            };

            const subscribeAndAttach = (publication) => {
                if (publication.publisher.id === me.id) return;

                const subscribeButton = document.createElement('button');
                subscribeButton.textContent = `${publication.publisher.id}: ${publication.contentType}`;
                buttonArea.appendChild(subscribeButton);

                subscribeButton.onclick = async () => {
                    const { stream } = await me.subscribe(publication.id);

                    let newMedia;
                    switch (stream.track.kind) {
                        case 'audio':
                            newMedia = document.createElement('audio');
                            newMedia.controls = true;
                            newMedia.autoplay = true;
                            break;
                        default:
                            return;
                    }
                    stream.attach(newMedia);
                    remoteMediaArea.appendChild(newMedia);
                };

                subscribeButton.click();
                Members++;
                Memberselem.textContent = Members + "人";
            };

            me.onPublicationUnsubscribed.add(() => {
                Members--;
                Memberselem.textContent = Members + "人";
            });

            room.publications.forEach(subscribeAndAttach);
            room.onStreamPublished.add((e) => subscribeAndAttach(e.publication));
        };
    })();
}

// マイクの権限確認
navigator.permissions.query({ name: 'microphone' }).then((result) => {
    if (result.state === 'granted') {
        console.log("マイクを利用します");
    } else {
        console.log("マイクの権限取得エラーです");
        alert("マイクを使用する権限を与えて下さい");
    }
});
