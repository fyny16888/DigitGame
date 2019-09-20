'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../../../share/constant');
var md5 = require('md5');
var logger = quick.logger.getLogger('connector', __filename);
var Const = require('../../../../share/const');
var NOTICE_TYPE = Const.NOTICE_TYPE;

var Handler = function (app) {
    this.app = app;
};

module.exports = function (app) {
    return new Handler(app);
};

var proto = Handler.prototype;

// RPC接口
proto.getRemoteById = function (gameId) {
    switch (gameId) {
        case 10001:
            return this.app.rpc.animal.animalRemote;
        case 10002:
            return this.app.rpc.golden.goldenRemote;
        case 10003:
            return this.app.rpc.niuniu.niuniuRemote;
        case 10004:
            return this.app.rpc.to.toRemote;
        case 10005:
            return this.app.rpc.pk.pkRemote;
        case 10006:
            return this.app.rpc.fruit.fruitRemote;
        // 房间型
        case 20001:
            return this.app.rpc.ddz.ddzRemote;
        case 20002:
            return this.app.rpc.tw.twRemote;
        case 20003:
            return this.app.rpc.clown.clownRemote;
    }
};

// 登陆
proto.login = P.coroutine(function* (msg, session, next) {
    if (session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_HAS_LOGGED });
    }
    if (!msg._id) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_MISSING_ID });
    }
    var playerId = msg._id;
    var ip = session.__session__.__socket__.remoteAddress.ip;
    var player = yield this.app.models.Player.findByIdReadOnlyAsync(playerId);
    if (!player) {
        player = yield this.app.controllers.player.createAsync(playerId, msg.name, msg.sex, msg.headurl, msg.spread, ip);
    }
    if (player.frozen) {
        return next(null, { code: C.FAILD, msg: C.PLAYER_IS_FROZEN });
    }
    var isOneLogin = (function (lastLoginTime) {
        var lastDate = new Date(lastLoginTime).getDate();
        var nowDate = new Date().getDate();
        return nowDate == lastDate ? '0' : '1';
    })(player.lastLoginTime);
    var self = this;
    var nextExecAsync = P.coroutine(function* () {
        session.bind(playerId);
        session.on('closed', function (session, reason) {
            if (reason === 'kick' || !session.uid) {
                return;
            }
            var goose = self.app.memdb.goose;
            goose.transaction(function () {
                return P.promisify(self.logout, self)({ closed: true }, session);
            }, self.app.getServerId())
                .catch(function (e) {
                    logger.error(e.stack);
                });
        });
        logger.info('player %s login', playerId);
        var hallController = self.app.controllers.hall;
        var nowTime = Date.now();
        var weekCount = hallController.getWeekNumber();
        var pls = player.signCount || [0, weekCount, Date.now()].join('|');
        var ps = pls.split('|');
        var hs = hallController.hasSign(nowTime, ps[2]);
        var hasSign = false;
        if (hs && Number(ps[0]) != 0) {
            hasSign = true;
        }
        var task = yield self.app.models.Task.findByIdAsync(playerId);
        if (task) {
            var ever = _.filter(task.tasks, { get_type: 0 });
            var trans = true;
            if (ever) {
                for (let t of ever) {
                    if (t && t.type == 2 && t.status == 2) {
                        var es = hallController.hasSign(nowTime, t.get_time);
                        if (es) trans = false;
                    }
                }
            }
            if (!trans) {
                for (let ta of task.tasks) {
                    if (ta && ta.type == 2 && ta.status == 1) {
                        var esa = hallController.hasSign(nowTime, ta.get_time);
                        if (esa) {
                            trans = true; break;
                        }
                    }
                }
            }
            if (trans) {
                yield hallController.pushMsgAsync([playerId], 'notice_message', { type: NOTICE_TYPE.task });
            }
        } else {
            yield hallController.pushMsgAsync([playerId], 'notice_message', { type: NOTICE_TYPE.task });
        }
        return next(null, {
            code: C.OK,
            data: {
                player: {
                    account: player.account,
                    name: player.name,
                    sex: player.sex,
                    gold: String(player.gold),
                    vip: String(player.vip),
                    quan: String(player.note),
                    isOneLogin: isOneLogin,
                    headurl: player.headurl,
                    hasRecharge: !!(player.totalMoney || 0),
                    sign: hasSign,
                    taskstate: '0',
                    emailstate: '0'
                }
            }
        });
    });
    var result = yield this.app.controllers.player.connectAsync(playerId, session.frontendId, ip);
    if (result.oldGameSvrId) {
		let oldGameSvrId = result.oldGameSvrId;
		let gameRemote = this.getRemoteById(result.oldGameId);
		if (gameRemote) gameRemote.leaveGame.toServer(oldGameSvrId, playerId, () => { });
	}
    if (result.oldConnectorId) {
        let oldConnectorId = result.oldConnectorId;
        let entryRemote = this.app.rpc.connector.entryRemote;
        yield P.promisify((cb) => entryRemote.kick({ frontendId: oldConnectorId }, playerId, (err, res) => cb(err, res)))();
    }
    return nextExecAsync();
});

//用户名登陆   暂时屏蔽
// proto.usernamelogin = P.coroutine(function* (msg, session, next) {
//     if (!msg.username || !msg.password || (msg.username && msg.username == '')) {
//         return next(null, { code: C.FAILD, msg: C.ILLEGAL });
//     }
//     if(msg.username.length > 40){
//         return next(null, { code: C.FAILD, msg: C.ILLEGAL });
//     }
//     let pI = md5(msg.username + 'hjdwc') + msg.pid;
//     let player = yield this.app.models.Player.findByIdAsync(pI);
//     if (player) {
//         if (player.password == msg.password) {
//             return next(null, { code: C.OK, uuid: player._id });
//         }
//         return next(null, { code: C.FAILD, msg: C.PLAYER_PASSWORD_WRONG });
//     } else {
//         return next(null, { code: C.FAILD, msg: C.PLAYER_NOT_FOUND });
//     }
// });

// 注册    暂时屏蔽
// proto.reg = P.coroutine(function* (msg, session, next) {
//     if (!msg.username || !msg.password || (msg.username && msg.username == '') || !msg.pid) {
//         return next(null, { code: C.FAILD, msg: C.ILLEGAL });
//     }
//     if(msg.username.length > 128){
//         return next(null, { code: C.FAILD, msg: C.ILLEGAL });
//     }
//     let pI = md5(msg.username + 'hjdwc') + msg.pid;
//     let player = yield this.app.models.Player.findByIdAsync(pI);
//     if (player) {
//         return next(null, { code: C.FAILD, msg: C.PLAYER_SAME_USERNAME });
//     }
//     var ip = session.__session__.__socket__.remoteAddress.ip;
//     player = yield this.app.controllers.player.createAsync(pI, msg.name, msg.sex, msg.headurl, msg.spread, ip, msg.username, msg.password);
//     return next(null, { code: C.OK, uuid: player._id });
// });

// 登出
proto.logout = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.FAILD, msg: C.PLAYER_NOT_LOGIN });
    }
    var playerId = session.uid;

    var result = yield this.app.controllers.player.disconnectAsync(playerId);
    if (result.oldGameSvrId) {
        let oldGameSvrId = result.oldGameSvrId;
        let gameRemote = this.getRemoteById(result.oldGameId);
        if (gameRemote) gameRemote.leaveGame.toServer(oldGameSvrId, playerId, () => { });
    }

    if (!msg.closed) {
        yield P.promisify(session.unbind, session)(playerId);
    }

    logger.info('player %s logout', playerId);
    return next(null, { code: C.OK });
});

