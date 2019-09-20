'use strict';

module.exports = function (app) {
    var mdbgoose = app.memdb.goose;
    var Types = mdbgoose.Schema.Types;

    var RwsSchema = new mdbgoose.Schema({
        _id: { type: String },                                              // 玩家ID
        create_time: { type: Number, default: Date.now }                    // 打赏描述  
    });

    var RewardSchema = new mdbgoose.Schema({
        _id: { type: String },                                              // 打赏ID 
        rewards: { type: [RwsSchema] },
    }, { collection: 'reward' });

    mdbgoose.model('Reward', RewardSchema);

    var TasksSchema = new mdbgoose.Schema({
        _id: { type: String },                                              // 任务ID
        type: { type: Number },                                             // 任务类型
        gift_type: { type: Number, default: 0 },                            // 任务奖品类型
        num: { type: Number, default: 0 },
        get_type: { type: Number, default: 0 },
        status: { type: Number, default: 0 },                               // 任务状态
        describe: { type: String },                                         // 任务描述
        title: { type: String },                                            // 任务标题
        progress: { type: Number, default: 0 },                             // 任务进度
        get_time: { type: Number, default: Date.now },                      // 获取奖励时间
        max: { type: Number, default: 10 }                                  // 任务最大值
    });

    var TaskSchema = new mdbgoose.Schema({
        _id: { type: String },                                              // 玩家ID
        tasks: { type: [TasksSchema] },
    }, { collection: 'task' });

    mdbgoose.model('Task', TaskSchema);

    var MoneyTreeSchema = new mdbgoose.Schema({
        _id: { type: String },                                              // 玩家ID
        level: { type: Number, default: 1 },
        per_hour: { type: Number, default: 2000 },
        get_time: { type: Number, default: Date.now }                       // 领取时间
    }, { collection: 'moneytree' });

    mdbgoose.model('MoneyTree', MoneyTreeSchema);

    var GiftsSchema = new mdbgoose.Schema({
        _id: { type: Number },
        desc: { type: String },                                             // 奖品描述
        icon: { type: String },                                             // 图片的名字
        name: { type: String },                                             // 奖品标题
        count: { type: Number },
        exchange_type: { type: Number, default: 1 },
        type: { type: Number, default: 1 },                                 // 所需物品类型
        rule: { type: Number, default: 0 },                                 // 兑换所需条件vip等级
        need_count: { type: Number },                                       // 所需物品数量
    });

    var GiftSchema = new mdbgoose.Schema({
        _id: { type: String },                                              // 奖品ID
        gifts: { type: [GiftsSchema] },
    }, { collection: 'gift' });

    var ErSchema = new mdbgoose.Schema({
        _id: { type: String },                                              // 
        name: { type: String },
        giftId: { type: Number },
        exchange_time: { type: Number },
        playerId: { type: String },
        status: { type: Number, default: 1 },                               // 1 未领取  2  已发货
        gift_name: { type: String },
        need_count: { type: Number },
        address: { type: String },
        count: { type: Number, default: 1 }
    }, { collection: 'exchangerecord' });

    mdbgoose.model('Exchangerecord', ErSchema);
    mdbgoose.model('Gift', GiftSchema);

    var ShopSchema = new mdbgoose.Schema({
        _id: { type: Number },                                              // 标识
        name: { type: String },                                             // 名称
        type: { type: Number, default: 1 },                                 // 类型1普通2月卡3pk票
        desc: { type: String },                                             // 描述
        rmb: { type: Number },                                              // 人民币（分）
        wate_rate: { type: Number, default: 0.05 },                         // 抽水比例
        continue_time: { type: Number, default: 0 },                        // 持续时间
        everyday_gold: { type: Number, default: 0 },                        // 每天领取
        num: { type: Number, default: 1 },                                  // 商品数量
        gold: { type: Number },                                             // 金币数
        backRmb: { type: Number, default: 0 }                               // 推荐返现
    }, { collection: 'shop' });

    mdbgoose.model('Shop', ShopSchema);

    var RedPackSchema = new mdbgoose.Schema({
        _id: { type: String },                                              // 标识
        uid: { type: String },                                              // 玩家Id
        gid: { type: Number },                                              // 游戏Id
        total: { type: Number },                                            // 总金额
        count: { type: Number },                                            // 人数
        golds: { type: [Number] },                                          // 红包值
        maxName: { type: String, default: '' },                             // 领最多人
        maxVal: { type: Number, default: 0 },                               // 领最多值
        atTime: { type: Number, default: Date.now }                         // 发放时间
    }, { collection: 'redpack' });

    mdbgoose.model('RedPack', RedPackSchema);

    var VipSchema = new mdbgoose.Schema({
        _id: { type: Number },                                              // VIP等级
        money: { type: Number },                                            // 充值额
        gold_percent: { type: Number }                                      // 百分比
    });

    var defaultVips = [
        { _id: 1, money: 600, gold_percent: 100 },
        { _id: 2, money: 2000, gold_percent: 200 },
        { _id: 3, money: 5000, gold_percent: 350 },
        { _id: 4, money: 10000, gold_percent: 550 },
        { _id: 5, money: 20000, gold_percent: 700 },
        { _id: 6, money: 50000, gold_percent: 900 },
        { _id: 7, money: 100000, gold_percent: 1000 },
        { _id: 8, money: 200000, gold_percent: 1200 },
        { _id: 9, money: 300000, gold_percent: 1300 },
        { _id: 10, money: 500000, gold_percent: 1400 },
        { _id: 11, money: 700000, gold_percent: 1500 },
        { _id: 12, money: 1000000, gold_percent: 1600 },
        { _id: 13, money: 1500000, gold_percent: 1700 },
        { _id: 14, money: 2000000, gold_percent: 1800 },
        { _id: 15, money: 3000000, gold_percent: 1900 },
    ];

    var VipsSchema = new mdbgoose.Schema({
        _id: { type: String },                                              // VIP标识
        vips: { type: [VipSchema], default: defaultVips },                  // VIP配置
    }, { collection: 'vip' });

    mdbgoose.model('Vip', VipsSchema);

    var drawsSchema = new mdbgoose.Schema({
        _id: { type: Number },
        get_times: { type: Number },                                        // 抽取次数上限
        max_tickets: { type: Number },                                      // 该玩法最大点劵数量
        has_use_tickets: { type: Number, default: 0 },
        single_ticket: { type: Number },                                    // 该玩法单次抽取数量上限
        min_single_ticket: { type: Number, default: 1 },                    // 该玩法单次抽取数量下限        
        cost_gold: { type: Number },                                        // 单次花费金币数量
        draw_rate: { type: Number },                                        // 抽奖中奖概率
        day_week: { type: Number, default: 1 }                              // 该游戏开放类型每天还是每周 1天 2周
    })

    var LuckdrawSchema = new mdbgoose.Schema({
        _id: { type: String },
        max_tickets: { type: Number },
        has_get_tickets: { type: Number },
        begin_time: { type: Number, default: Date.now },                    // 该游戏开始时间
        end_time: { type: Number },                                         // 该游戏结束时间
        draws: { type: [drawsSchema] }
    }, { collection: 'luckdraw' });

    //个人抽奖管理

    var drawsSelfSchema = new mdbgoose.Schema({
        _id: { type: Number },
        get_time: { type: Number, default: Date.now },                      // 上次抽取时间
        get_times: { type: Number },                                        // 抽取次数上限
        has_times: { type: Number, default: 0 },                            // 已抽取次数
        get_draws: { type: Number, default: 0 }                             // 已获取奖券数量
    })

    var SelfdrawsSchema = new mdbgoose.Schema({
        _id: { type: String },                                              // 玩家Id
        total_draw: { type: Number, default: 0 },
        draws: { type: [drawsSelfSchema] }
    }, { collection: 'selfdraws' });

    var drawRecordSchema = new mdbgoose.Schema({
        _id: { type: String },
        count: { type: Number, default: 0 },                                // 数量
        draw_time: { type: Number, default: Date.now },
        playerId: { type: String },
        drawId: { type: Number },
        draw_before: { type: Number },
        draw_after: { type: Number }
    }, { collection: 'draw_record' });

    mdbgoose.model('Luckdraw', LuckdrawSchema);
    mdbgoose.model('Selfdraws', SelfdrawsSchema);
    mdbgoose.model('DrawRecord', drawRecordSchema);

    var proposalsSchema = new mdbgoose.Schema({
        _id: { type: String },
        name: { type: String },
        time: { type: Number, default: Date.now },
        playerId: { type: String },
        state: { type: Number, default: 0 },
        text: { type: String }
    }, { collection: 'proposals' });

    var ProposalSchema = new mdbgoose.Schema({
        _id: { type: String },                                              // 玩家Id
        time: { type: Number },
        times: { type: Number }
    }, { collection: 'proposal' });

    mdbgoose.model('Proposal', ProposalSchema);
    mdbgoose.model('Proposals', proposalsSchema);

    var singleDataSchema = new mdbgoose.Schema({
        _id: { type: String },
        data: Types.Mixed
    }, { collection: 'singleData' });

    mdbgoose.model('SingleData', singleDataSchema);

    var moneyRedPackRecordSchema = new mdbgoose.Schema({
        _id: { type: String },
        playerId: { type: String },
        desc: { type: String, default: '' },
        status: { type: Number, default: 1 }
    }, { collection: 'moneyRedPackRecord' });

    mdbgoose.model('MoneyRedPackRecord', moneyRedPackRecordSchema);

    var dialRecordSchema = new mdbgoose.Schema({
        _id: { type: String },
        playerId: { type: String },
        type: { type: Number },
        time: { type: Number, default: Date.now },
        num: { type: Number },
        name: { type: String }
    }, { collection: 'dialRecord' });

    mdbgoose.model('DialRecord', dialRecordSchema);

    var answerSchema = new mdbgoose.Schema({
        _id: { type: Number },
        max_playerId: { type: String, default: '0' },
        max_name: { type: String, default: '0' },
        max_bet: { type: Number, default: 0 },
        total_count: { type: Number },
        total_bet: { type: Number },
        rate: { type: Number, default: 2 },
        title: { type: String }
    });

    // 竞猜活动表
    var competitionListSchema = new mdbgoose.Schema({
        _id: { type: String },
        begin_time: { type: Number },
        end_time: { type: Number },
        open_time: { type: Number },
        title: { type: String },
        image_url: { type: String },
        // rate: { type: Number, default: 2 },
        wate_rate: { type: Number, default: 0.05 },
        answer: { type: [answerSchema] }
    }, { collection: 'competition' });

    mdbgoose.model('CompetitionList', competitionListSchema);

    // 竞猜活动记录表
    var competitionListRecordSchema = new mdbgoose.Schema({
        _id: { type: String },
        begin_time: { type: Number },
        end_time: { type: Number },
        open_time: { type: Number },
        title: { type: String },
        image_url: { type: String },
        result: { type: Number },                                       // 答案 1 A  2  B
        rate: { type: Number, default: 2 },
        wate_rate: { type: Number, default: 0.05 },
        answer: { type: [answerSchema] }
    }, { collection: 'competitionRecord' });

    mdbgoose.model('CompetitionListRecord', competitionListRecordSchema);

    var betArrSchema = new mdbgoose.Schema({
        _id: { type: String },
        bet_gold: { type: Number },
        r_w: { type: Number },
        answer: { type: Number }
    });

    // 个人竞猜表
    var selfCompetitionSchema = new mdbgoose.Schema({
        _id: { type: String },
        bet_arr: { type: [betArrSchema] },
    }, { collection: 'selfcompetition' });

    mdbgoose.model('Selfcompetition', selfCompetitionSchema);

    //个人竞猜记录表
    var selfCompetitionRecordSchema = new mdbgoose.Schema({
        _id: { type: String },
        playerId: { type: String },
        bet_arr: { type: [betArrSchema] },
    }, { collection: 'selfcompetitionrecord' });

    mdbgoose.model('SelfcompetitionRecord', selfCompetitionRecordSchema);

    //个人地址表
    var addressSchema = new mdbgoose.Schema({
        _id: { type: String },
        address: { type: String }
    }, { collection: 'address' });

    mdbgoose.model('Address', addressSchema);
};

