'use strict';

var logger = require('quick-pomelo').logger.getLogger('connector', __filename);
var P = require('quick-pomelo').Promise;
var util = require('util');

var Remote = function(app){
    this.app = app;
};

module.exports = function(app){
    return new Remote(app);
};

Remote.prototype.kick = function(playerId, cb){
    logger.warn('kicking %s', playerId);

    var sessionService = this.app.get('sessionService');

    return P.promisify(sessionService.kick, sessionService)(playerId)
    .nodeify(cb);
};

Remote.prototype.getUids = function(playerId, cb) {
    var sessionService = this.app.get('sessionService');
    var playerIds = [];
    if (!!sessionService) {
        sessionService.forEachBindedSession(function(session){
            if (!!session.uid) {
                playerIds.push(session.uid);
            }
        });
    }
    cb(null, playerIds);
};

