'use strict';

var _ = require('lodash');
var C = require('../../../../share/constant');

var Handler = function (app) {
    this.app = app;
};

module.exports = function (app) {
    return new Handler(app);
};

var proto = Handler.prototype;

proto.getConnector = function (msg, session, next) {
    var servers = this.app.getServersByType('connector');
    var server = _.sample(servers);
    if (!server) {
        return next(null, { code: C.FAILD, msg: C.GATE_NO_CONNECTOR });
    }
    var completed = this.app.controllers.gate.isCompleted();
    if (!completed) {
        return next(null, { code: C.FAILD, msg: C.GATE_NO_CONNECTOR });
    }
    var data = { code: C.OK, data: { host: server.clientHost, port: server.clientPort } };
    return next(null, data);
};

