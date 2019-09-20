'use strict';

module.exports = function (app) {
    var mdbgoose = app.memdb.goose;

    var GameSchema = new mdbgoose.Schema({
        _id: { type: Number },                                      // 游戏ID
        cell: { type: Number }                                      // 单注
    });

    var defaultInfo = [                                             // 默认
        { _id: 10001, cell: 1000 },                                 // 金鲨
        { _id: 10002, cell: 1000 }                                  // 扎金花
    ];

    var GiftsSchema = new mdbgoose.Schema({
        _id: { type: Number },                                      // 时间戳
        giftId: { type: Number },
        type: { type: Number, default: 0 }                          // 是否兑换
    });

    var PlayerSchema = new mdbgoose.Schema({
        _id: { type: String },                                      // 标识
        account: { type: String },                                  // 账号
        name: { type: String, default: '' },                        // 昵称
        updatename: { type: Number, default: 1 },                   // 是否修改昵称
        sex: { type: String, default: '0' },                        // 性别
        headurl: { type: String, default: '' },                     // 头像
        gold: { type: Number, default: 0 },                         // 金币
        note: { type: Number, default: 10 },                        // 点券
        bank: { type: Number, default: 0 },                         // 银行
        vip: { type: Number, default: 0 },                          // VIP
        totalMoney: { type: Number, default: 0 },                   // 累计充值
        gift: { type: [GiftsSchema] },                              // 奖品
        priority: { type: Number, default: 10 },                    // 优先级
        gameId: { type: Number, default: 0 },                       // 游戏ID
        gameInfo: { type: [GameSchema], default: defaultInfo },     // 游戏数据
        gameServerId: { type: String, default: '' },                // 游戏点
        pk_ticket: { type: Number, default: 0 },                    // PK票
        connectorId: { type: String, default: '' },                 // 连接点
        registerIp: { type: String, default: '' },                  // 注册IP
        lastLoginIp: { type: String, default: '' },                 // 登录IP
        registerTime: { type: Number, default: Date.now },          // 注册时间
        roleTime: { type: Number, default: 0 },                     // 角色时间
        todayGold: { type: Number, default: 0 },                    // 今日金币
        lastLoginTime: { type: Number, default: 0 },                // 最近登录
        signCount: { type: String },                                // 每周签到次数
        dsSign: { type: String },                                   // 打赏标识
        jjGold: { type: String },                                   // 救济金
        fortuneTimes: { type: Number, default: 0 },                 // 幸运大转盘次数
        toScore: { type: Number, default: 0 },                      // 21点积分
        toTimes: { type: Number, default: 5 },                      // 21点次数
        follow: { type: Number, default: 0 },                       // 是否关注游戏 
        onlineTime: { type: Number, default: 0 },                   // 当日在线时长
        wateRate: { type: Number, default: 0.05 },                  // 抽水比例
        wateInvalid: { type: Number, default: 0 },                  // 过期时间
        spreader: { type: String, default: '' },                    // 推荐人
        backRmb: { type: Number, default: 0 },                      // 返现
        frozen: { type: Number, default: 0 },                       // 冻结
        offlineTime: { type: Number, default: 0 }                   // 离线时间
    }, { collection: 'player' });

    mdbgoose.model('Player', PlayerSchema);

    var RrecordsSchema = new mdbgoose.Schema({
        _id: { type: Number },									    // 时间
        rmb: { type: Number },
        shop_id: { type: Number }                                   // 商品ID
    });

    var RechargerecordSchema = new mdbgoose.Schema({
        _id: { type: String },                                      // 玩家ID
        records: { type: [RrecordsSchema] }
    }, { collection: 'rechargerecord' });

    mdbgoose.model('Rechargerecord', RechargerecordSchema);

    var McsSchema = new mdbgoose.Schema({
        _id: { type: Number },                                      // 商品ID
        expire_time: { type: Number, default: 0 },                  // 过期时间
        everyDay: { type: Number, default: 10000000 },              // 每日领取
        getGold: { type: Number, default: 1200000000 },             // 获得金币
        get_time: { type: Number, default: 0 }                      // 领取时间
    });

    var MonthCardSchema = new mdbgoose.Schema({
        _id: { type: String },                                      // 玩家ID
        cards: [McsSchema]											// 拥有月卡
    }, { collection: 'monthcard' });

    mdbgoose.model('Monthcard', MonthCardSchema);

    var mailsSchema = new mdbgoose.Schema({
        _id: { type: Number },                                      // 商品ID
        sname: { type: String, default: '0' },                      // 领取时间
        content: { type: String },
        mail_type: { type: Number, default: 0 },
        title: { type: String }
    });

    var MailerSchema = new mdbgoose.Schema({
        _id: { type: Number },                                      // 邮件ID
        sname: { type: String, default: '0' },
        content: { type: String },
        mail_type: { type: Number, default: 0 },
        title: { type: String }									    // 拥有月卡
    }, { collection: 'mail' });

    mdbgoose.model('Mailer', MailerSchema);

    var BaseMail = new mdbgoose.Schema({
        _id: Number,
        state: { type: Number, default: 0 },                        // 邮件状态: 0(未完成,未领取,未查看) 1(完成,领取,已读)
        title: String,
        sname: String
    });

    var PlayerMailSchema = new mdbgoose.Schema({
        _id: { type: String },
        mails: [BaseMail]
    }, { collection: 'player_mail' });
    mdbgoose.model('PlayerMail', PlayerMailSchema);
};

