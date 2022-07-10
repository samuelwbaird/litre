// handle resources for litre apps, manage web queries, cache and share resources
// copyright 2022 Samuel Baird MIT Licence

// plain web queries
// managed web queries (with wrap, queueing, retry, backoff)
// cache/store/get from cache
// loaders for specific resource types

function _query (method, url, data, successHandler, errorHandler, timeout) {
	const xhr = new XMLHttpRequest();

	xhr.open(method, url, true);
	xhr.onreadystatechange = function () {
		let status;
		let data;
		if (xhr.readyState == 4) { // `DONE`
			status = xhr.status;
			if (status == 200) {
				if (xhr.responseText != '') {
					data = JSON.parse(xhr.responseText);
				}
				successHandler && successHandler(data);
			} else {
				errorHandler && errorHandler(status);
			}
			successHandler = null;
			errorHandler = null;
		}
	};
	if (timeout != undefined) {
		xhr.timeout = timeout;
	}

	if (data != null) {
		xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
		xhr.send(JSON.stringify(data));
	} else {
		xhr.send();
	}

	return xhr;
}

// public api
const query = {
	post: function (url, data, successHandler, errorHandler) {
		return _query('post', url, data, successHandler, errorHandler);
	},
	get: function (url, successHandler, errorHandler) {
		return _query('get', url, null, successHandler, errorHandler);
	},
};

export { query };