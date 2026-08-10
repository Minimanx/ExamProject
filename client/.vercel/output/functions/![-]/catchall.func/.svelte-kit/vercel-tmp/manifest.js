export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.png","global.css","water-tile.svg"]),
	mimeTypes: {".png":"image/png",".css":"text/css",".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.B1JLH9-x.js",app:"_app/immutable/entry/app.BSEbBsOw.js",imports:["_app/immutable/entry/start.B1JLH9-x.js","_app/immutable/chunks/C4rghkfP.js","_app/immutable/chunks/DMBGR548.js","_app/immutable/chunks/BhJxURJ-.js","_app/immutable/entry/app.BSEbBsOw.js","_app/immutable/chunks/DMBGR548.js","_app/immutable/chunks/xihTtKlq.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('../output/server/nodes/0.js')),
			__memo(() => import('../output/server/nodes/1.js')),
			__memo(() => import('../output/server/nodes/2.js')),
			__memo(() => import('../output/server/nodes/3.js')),
			__memo(() => import('../output/server/nodes/4.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/theaters/[id]",
				pattern: /^\/theaters\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/[...rest]",
				pattern: /^(?:\/([^]*))?\/?$/,
				params: [{"name":"rest","optional":false,"rest":true,"chained":true}],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
