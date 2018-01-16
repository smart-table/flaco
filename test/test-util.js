export const waitNextTick = () => new Promise(function (resolve) {
	setTimeout(function () {
		resolve();
	}, 2)
});
