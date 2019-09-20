'use strict';

var _ = require('lodash');
var P = require('quick-pomelo').Promise;

// 金鲨银鲨
exports.animalIds = {};
exports.animalRoute = P.coroutine(function* (session, msg, app, cb) {
    let servers = app.getServersByType('animal');
    var serverId = _.sample(servers).id;

    var uid = session.uid;
    if (uid) {
        let sid = exports.animalIds[uid];
        if (sid) {
            serverId = sid;
        }
        else {
            let player = yield app.memdb.goose.transactionAsync(P.coroutine(function* () {
                return app.models.Player.findByIdReadOnlyAsync(uid, 'gameServerId');
            }), app.getServerId());
            if (player && player.gameServerId) {
                serverId = player.gameServerId;
            }
            exports.animalIds[uid] = serverId;
        }

    }
    cb(null, serverId);
});

// 百人金花
exports.goldenIds = {};
exports.goldenRoute = P.coroutine(function* (session, msg, app, cb) {
    let servers = app.getServersByType('golden');
    var serverId = _.sample(servers).id;

    var uid = session.uid;
    if (uid) {
        let sid = exports.goldenIds[uid];
        if (sid) {
            serverId = sid;
        }
        else {
            let player = yield app.memdb.goose.transactionAsync(P.coroutine(function* () {
                return app.models.Player.findByIdReadOnlyAsync(uid, 'gameServerId');
            }), app.getServerId());
            if (player && player.gameServerId) {
                serverId = player.gameServerId;
            }
            exports.goldenIds[uid] = serverId;
        }

    }
    cb(null, serverId);
});

// 白人牛牛
exports.niuniuIds = {};
exports.niuniuRoute = P.coroutine(function* (session, msg, app, cb) {
    let servers = app.getServersByType('niuniu');
    var serverId = _.sample(servers).id;

    var uid = session.uid;
    if (uid) {
        let sid = exports.niuniuIds[uid];
        if (sid) {
            serverId = sid;
        }
        else {
            let player = yield app.memdb.goose.transactionAsync(P.coroutine(function* () {
                return app.models.Player.findByIdReadOnlyAsync(uid, 'gameServerId');
            }), app.getServerId());
            if (player && player.gameServerId) {
                serverId = player.gameServerId;
            }
            exports.niuniuIds[uid] = serverId;
        }

    }
    cb(null, serverId);
});

// 21点
exports.toIds = {};
exports.toRoute = P.coroutine(function* (session, msg, app, cb) {
    let servers = app.getServersByType('to');
    var serverId = _.sample(servers).id;

    var uid = session.uid;
    if (uid) {
        let sid = exports.toIds[uid];
        if (sid) {
            serverId = sid;
        }
        else {
            let player = yield app.memdb.goose.transactionAsync(P.coroutine(function* () {
                return app.models.Player.findByIdReadOnlyAsync(uid, 'gameServerId');
            }), app.getServerId());
            if (player && player.gameServerId) {
                serverId = player.gameServerId;
            }
            exports.toIds[uid] = serverId;
        }

    }
    cb(null, serverId);
});

// PK场
exports.pkIds = {};
exports.pkRoute = P.coroutine(function* (session, msg, app, cb) {
    let servers = app.getServersByType('pk');
    var serverId = _.sample(servers).id;

    var uid = session.uid;
    var room = msg && msg.args[0] && msg.args[0].body && msg.args[0].body.room;
    if (room) {
        let index = String(room).charAt(0);
        let _serverId = 'pk-server-' + index;
        let _index = _.findIndex(servers, { id: _serverId });
        if (-1 != _index) {
            serverId = _serverId;
            if (uid) {
                exports.pkIds[uid] = serverId;
            }
        }
    }
    else if (uid) {
        let sid = exports.pkIds[uid];
        if (sid) {
            serverId = sid;
        }
        else {
            let player = yield app.memdb.goose.transactionAsync(P.coroutine(function* () {
                return app.models.Player.findByIdReadOnlyAsync(uid, 'gameServerId');
            }), app.getServerId());
            if (player && player.gameServerId) {
                serverId = player.gameServerId;
            }
            exports.pkIds[uid] = serverId;
        }

    }
    cb(null, serverId);
});

// 房间斗地主
exports.ddzIds = {};
exports.ddzRoute = P.coroutine(function* (session, msg, app, cb) {
    var servers = app.getServersByType('ddz');
    var serverId = _.sample(servers).id;

    var uid = session.uid;
    var tableId = msg && msg.args[0] && msg.args[0].body && msg.args[0].body.tableId;
    if (tableId) {
        let index = String(tableId).charAt(0);
        let _serverId = 'ddz-server-' + index;
        let _index = _.findIndex(servers, { id: _serverId });
        if (-1 != _index) {
            serverId = _serverId;
            if (uid) {
                exports.ddzIds[uid] = serverId;
            }
        }
    }
    else if (uid) {
        if (exports.ddzIds[uid]) {
            serverId = exports.ddzIds[uid];
        }
        else {
            let player = yield app.memdb.goose.transactionAsync(P.coroutine(function* () {
                return app.models.Player.findByIdReadOnlyAsync(uid, 'gameServerId');
            }), app.getServerId());
            if (player && player.gameServerId) {
                serverId = player.gameServerId;
            }
            exports.ddzIds[uid] = serverId;
        }
    }
    cb(null, serverId);
});

// 房间十三水
exports.twIds = {};
exports.twRoute = P.coroutine(function* (session, msg, app, cb) {
    var servers = app.getServersByType('tw');
    var serverId = _.sample(servers).id;

    var uid = session.uid;
    var tableId = msg && msg.args[0] && msg.args[0].body && msg.args[0].body.tableId;
    if (tableId) {
        let index = String(tableId).charAt(0);
        let _serverId = 'tw-server-' + index;
        let _index = _.findIndex(servers, { id: _serverId });
        if (-1 != _index) {
            serverId = _serverId;
            if (uid) {
                exports.twIds[uid] = serverId;
            }
        }
    }
    else if (uid) {
        if (exports.twIds[uid]) {
            serverId = exports.twIds[uid];
        }
        else {
            let player = yield app.memdb.goose.transactionAsync(P.coroutine(function* () {
                return app.models.Player.findByIdReadOnlyAsync(uid, 'gameServerId');
            }), app.getServerId());
            if (player && player.gameServerId) {
                serverId = player.gameServerId;
            }
            exports.twIds[uid] = serverId;
        }
    }
    cb(null, serverId);
});

// 快乐小丑
exports.clownIds = {};
exports.clownRoute = P.coroutine(function* (session, msg, app, cb) {
    let servers = app.getServersByType('clown');
    var serverId = _.sample(servers).id;

    var uid = session.uid;
    if (uid) {
        let sid = exports.clownIds[uid];
        if (sid) {
            serverId = sid;
        }
        else {
            let player = yield app.memdb.goose.transactionAsync(P.coroutine(function* () {
                return app.models.Player.findByIdReadOnlyAsync(uid, 'gameServerId');
            }), app.getServerId());
            if (player && player.gameServerId) {
                serverId = player.gameServerId;
            }
            exports.clownIds[uid] = serverId;
        }

    }
    cb(null, serverId);
});

// 水果游戏
exports.fruitIds = {};
exports.fruitRoute = P.coroutine(function* (session, msg, app, cb) {
    let servers = app.getServersByType('fruit');
    var serverId = _.sample(servers).id;

    var uid = session.uid;
    if (uid) {
        let sid = exports.fruitIds[uid];
        if (sid) {
            serverId = sid;
        }
        else {
            let player = yield app.memdb.goose.transactionAsync(P.coroutine(function* () {
                return app.models.Player.findByIdReadOnlyAsync(uid, 'gameServerId');
            }), app.getServerId());
            if (player && player.gameServerId) {
                serverId = player.gameServerId;
            }
            exports.fruitIds[uid] = serverId;
        }

    }
    cb(null, serverId);
});

