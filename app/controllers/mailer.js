'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
// var md5 = require('md5');
// var uuid = require('node-uuid');
var C = require('../../share/constant');
var Const = require('../../share/const');
var NOTICE_TYPE = Const.NOTICE_TYPE;
var logger = quick.logger.getLogger('mailer', __filename);

var Controller = function (app) {
    this.app = app;
};

module.exports = function (app) {
    return new Controller(app);
};

var proto = Controller.prototype;

var cor = P.coroutine;

// 创建邮件
proto.createMailAsync = cor(function* (playerIds, title, mailcontent, sendId) {
    if (typeof playerIds == 'string') {
        playerIds = [playerIds];
    }
    var nowTime = Date.now();
    var bm = { _id: nowTime, sname: '0', content: mailcontent, title: title };
    if (sendId) {
        bm.mail_type = 1;
        var sp = yield this.app.models.Player.findByIdReadOnlyAsync(sendId);
        bm.sname = (sp && sp.name) || sendId;
    }
    var baseMail = new this.app.models.Mailer(bm);
    yield baseMail.saveAsync();
    for (var i = 0; i < playerIds.length; i++) {
        var playerId = playerIds[i];
        var plm = yield this.app.models.PlayerMail.findByIdAsync(playerId);
        var pm = { _id: nowTime, state: 0, title: title, sname: bm.sname };
        if (!plm) {
            plm = new this.app.models.PlayerMail({ _id: playerId });
            plm.mails = [];
        }
        plm.mails.push(pm);
        yield plm.saveAsync();
    }
    return this.app.controllers.hall.pushMsgAsync(playerIds, 'notice_message', { type: NOTICE_TYPE.mail });
});

// 获取邮件列表
proto.getMailsAsync = cor(function* (playerId) {
    var pms = yield this.app.models.PlayerMail.findByIdAsync(playerId);
    var ps = [];
    if (pms) {
        ps = _.clone(pms.mails);
        ps = ps.splice(-10);
    }
    return { code: C.OK, mails: ps };
});

// 查看邮件内容
proto.lookMailAsync = cor(function* (playerId, mailId) {
    var mailC = yield this.app.models.Mailer.findByIdAsync(mailId);
    if (mailC) {
        return { code: C.OK, content: mailC.content };
    }
    return { code: C.FAILD };
});

// 删除玩家邮件列表
proto.removeMailAsync = cor(function* (playerId, mailIds) {
    if (typeof mailIds == 'number') {
        mailIds = [mailIds];
    }
    var pms = yield this.app.models.PlayerMail.findByIdAsync(playerId);
    var mails = _.clone(pms.mails);
    for (var i = 0; i < mailIds.length; i++) {
        var ri = _.findIndex(mails, function (n) { return n._id == mailIds[i] });
        if (ri != -1) {
            mails.splice(ri, 1);
        }
    }
    pms.mails = mails;
    yield pms.saveAsync();
    return { code: C.OK };
})