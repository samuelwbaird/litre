// handle resources for litre apps, manage web queries, cache and share resources
// copyright 2022 Samuel Baird MIT Licence

// plain web queries
// managed web queries (with wrap, queueing, retry, backoff)
// cache/store/get from cache
// add custom loaders for specific resource types


// set_image_base_path
// get_image

// set_audio_base_path
// get_audio

// get_json_base_path
// get_json

// get_text_base_path
// get_text

// get (raw)

// add_loader (type, transform function) ... creates get_ and set_?_base_path

// query.get
// query.post
// query.managed

// is_loading
// load_progress
// when_loaded -> callback

// resource update tick (timeout based)
// retries and backoff

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