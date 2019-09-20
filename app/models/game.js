'use strict';

module.exports = function (app) {
	var mdbgoose = app.memdb.goose;
	var Types = mdbgoose.Schema.Types;

	var GamebetsSchema = new mdbgoose.Schema({
		_id: { type: Number },                                      		// 游戏
		bets: [Types.Mixed],												// 下注
		result: { type: Number, default: 0 },								// 结果
		banker: { type: String, default: '0' },								// 庄家，0系统
		bankers: { type: [String] },										// 上庄列表
		bankCount: { type: Number, default: 10 },							// 局数
		gift: { type: Number, default: 0 },									// 彩金池
		rate: { type: Number, default: 0.05 },								// 抽水比例
		recent: { type: [Number] },											// 最近结果
		present: { type: Number, default: 0 },								// 发彩金
		startTime: { type: Number, default: Date.now }						// 开始时间
	}, { collection: 'gamebets' });		
		
	var RecordSchema = new mdbgoose.Schema({		
		_id: { type: Number },												// 时间
		gameId: { type: Number },											// 游戏
		bets: [Types.Mixed],												// 下注
		result: { type: Number },											// 结果
		gift: { type: Number, default: 0 },									// 彩金池
	}, { collection: 'gamerecord' });

	mdbgoose.model('Gamebets', GamebetsSchema);
	mdbgoose.model('GameRecord', RecordSchema);

	var GoldenBetsSchema = new mdbgoose.Schema({
		_id: { type: Number },
		score: { type: Number }
	});

	var defaultGoldenBets = [												// 默认下注
		{ _id: 0, score: 0 },
		{ _id: 1, score: 0 },
		{ _id: 2, score: 0 },
		{ _id: 3, score: 0 },
		{ _id: 4, score: 0 },
	];
	var defaultMuls = [
		{ _id: 1, mul: 1 },
		{ _id: 2, mul: 2 },
		{ _id: 4, mul: 3 },
		{ _id: 8, mul: 4 },
		{ _id: 16, mul: 5 },
		{ _id: 32, mul: 6 }
	];

	var GoldenMulsSchema = new mdbgoose.Schema({
		_id: { type: Number },
		mul: { type: Number }
	});
	var GoldenSeatsSchema = new mdbgoose.Schema({
		_id: { type: Number },
		player: { type: String }
	});

	var defaultGoldenSeat = [
		{ _id: 1, player: '0' },
		{ _id: 2, player: '0' },
		{ _id: 3, player: '0' },
		{ _id: 4, player: '0' },
		{ _id: 5, player: '0' },
		{ _id: 6, player: '0' },
		{ _id: 7, player: '0' },
		{ _id: 0, player: '0' }
	];

	var GoldenRecordsSchema = new mdbgoose.Schema({
		_id: { type: Number },												// 时间
		bets: { type: [GoldenBetsSchema], default: defaultGoldenBets },		// 下注
		result: Types.Mixed,												// 结果
		gift: { type: Number, default: 0 },									// 彩金池
	});

	var GoldenRecordSchema = new mdbgoose.Schema({
		_id: { type: Number },												// 游戏ID
		records: { type: [GoldenRecordsSchema] },							// 游戏
	}, { collection: 'goldenrecord' });

	var GoldenGameSchema = new mdbgoose.Schema({
		_id: { type: Number },                                      		// 游戏
		bets: { type: [GoldenBetsSchema], default: defaultGoldenBets },		// 下注
		muls: { type: [GoldenMulsSchema], default: defaultMuls },
		result: Types.Mixed,												// 结果
		banker: { type: String, default: '0' },								// 庄家
		bankCount: { type: Number, default: 10 },							// 局数
		seats: { type: [GoldenSeatsSchema], default: defaultGoldenSeat },
		global_obj: { type: Types.Mixed },
		gift: { type: Number, default: 0 },									// 彩金池
		rate: { type: Number, default: 0.05 },								// 抽水比例
		bankers: { type: [String] },										// 上庄列表
		startTime: { type: Number, default: Date.now }						// 开始时间
	}, { collection: 'goldengame' });

	mdbgoose.model('GoldenGame', GoldenGameSchema);
	mdbgoose.model('GoldenRecord', GoldenRecordSchema);

	var GameConfigSchema = new mdbgoose.Schema(
		{
			_id: { type: Number },											// 游戏ID
			config: Types.Mixed												// 游戏配置
		}, { collection: 'gameconfig' }
	);

	mdbgoose.model('GameConfig', GameConfigSchema);

	/******************** 快乐小丑 ********************/
	var ClownInfoSchema = new mdbgoose.Schema({
		_id: { type: Number },												// 游戏ID
		maxId: { type: String, default: '' },								// 赢最多
		maxVal: { type: Number, default: 0 },								// 赢最多
		tGift: { type: Number, default: 0 },								// 彩金池
		lastTime: { type: Number, default: 0 }								// 游戏时间
	}, { collection: 'clowninfo' });

	var ClownPlayerSchema = new mdbgoose.Schema({
		_id: { type: String },												// 玩家ID
		name: { type: String },												// 昵称
		sex: { type: String, default: '0' },								// 性别
		headurl: { type: String, default: '' },								// 头像
		wWin: { type: Number, default: 0 },									// 周赢总和
		dWin: { type: Number, default: 0 },									// 日赢总和
		lastTime: { type: Number, default: 0 }								// 游戏时间
	}, { collection: 'clownplayer' });

	mdbgoose.model('ClownInfo', ClownInfoSchema);
	mdbgoose.model('ClownPlayer', ClownPlayerSchema);
};

