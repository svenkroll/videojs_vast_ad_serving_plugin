// <author>Sven Kroll</author>
// <email>kroll.sven@gmail.com</email>
// <date>2013-11-11</date>
// <summary>video.js Vast plugin supporting pre-, and post-rolls</summary>

function vastPlugin(options) {
	var player = this,
	maxWrapperRedirects = 5,
	maxPreRolls = 1,
	maxPostRolls = 1,
	_v = {};

	initAds(options); //only create AdSlots and dont request right now
	initListener();

	function initListener() {
		player.on('ended', function(e) {
			//if maintrack has ended
			if (_v.currentSlot === null) {
				if (_v.postrolls < maxPostRolls) {
					//check if post-roll exists
					for (var i = 0; i < _v.adList.length; i++) {
						if (_v.adList[i].getAdType() === "post-roll" && !_v.adList[i].isSeen()) {
							playAd(_v.adList[i]);
						}
					}
				}
			} else { //Ad ended
				stopAd(_v.currentSlot);
			}
		});

		player.on('error', function(e) {
			console.log('VastPlugin::error: ' + e);
		});

		player.on('volumechange', function(e) {
			if (_v.currentSlot) {
				if (player.muted() && !_v.muted) {
					//user has muted
					_v.muted = true;
					var trackingEvents = _v.currentSlot.getTrackingEventUrls('mute');
					trackingEvents.forEach(function(element) {
						loadTrackingPixel(element['eventUrl']);
					});
				} else if (!player.muted() && _v.muted) {
					//user has unmuted
					_v.muted = false;
					//call tracking events
					var trackingEvents = _v.currentSlot.getTrackingEventUrls('unmute');
					trackingEvents.forEach(function(element) {
						loadTrackingPixel(element['eventUrl']);
					});
				}
			};
		});

		player.on('play', function(e) {
			//if maintrack is starting
			if (_v.prerolls < maxPreRolls && _v.currentSlot === null) {				
				//check if pre-roll exists
				for (var i = 0; i < _v.adList.length; i++) {
					if (_v.adList[i].getAdType() === "pre-roll" && !_v.adList[i].isSeen()) {
						playAd(_v.adList[i]);
						break;
					}
				}
			};
		});

		player.on('fullscreenchange', function(e) {
			if (_v.currentSlot) {
				if (!_v.fullScreen) {
					//user has switched to fullscreen
					_v.fullscreen = true;
					var trackingEvents = _v.currentSlot.getTrackingEventUrls('fullscreen');
					trackingEvents.forEach(function(element) {
						loadTrackingPixel(element['eventUrl']);
					});
				} else {
					//user has canceled fullscreen
					_v.fullscreen = false;
				}
			};
		});

		player.on('pause', function(e) {
			if (_v.currentSlot) {
				if (player.paused() && player.currentTime() < player.duration()) {
					//user has paused
					var trackingEvents = _v.currentSlot.getTrackingEventUrls('pause');
					trackingEvents.forEach(function(element) {
						loadTrackingPixel(element['eventUrl']);
					});
				}
			};
		});
	};

	function adError() {
		var errorTrackingUrls = _v.currentSlot.getErrorTrackingUrls();
		errorTrackingUrls.forEach(function(element) {
			loadTrackingPixel(element);
		});

		console.log("VastParser::no compatible ad source");

		player.controlBar.progressControl.show();
		player.controlBar.currentTimeDisplay.show();
		player.controlBar.timeDivider.show();
		player.controlBar.durationDisplay.show();

		//enable fade out
		removeClass(player.controlBar.el(), 'vjs-manual-lock-showing');

		//remove overlay
		//TODO: Document isn't good if multiple player available
		player.el()
			.removeChild(document.getElementById('stage-overlay'));

		//stop interval and remove advertiser info
		clearInterval(_v.adPlayInterval)
		player.controlBar.el()
			.removeChild(document.getElementById('info-ad-time'));

		_v.currentSlot = null;

	};

	function hasClass(ele, cls) {
		return ele.className.match(new RegExp('(\\s|^)' + cls + '(\\s|$)'));
	};

	function addClass(ele, cls) {
		if (!hasClass(ele, cls)) ele.className += " " + cls;
	};

	function removeClass(ele, cls) {
		if (hasClass(ele, cls)) {
			var reg = new RegExp('(\\s|^)' + cls + '(\\s|$)');
			ele.className = ele.className.replace(reg, ' ');
		}
	};

	function stopAd(adslot) {
		//call tracking events
		var trackingEvents = _v.currentSlot.getTrackingEventUrls('complete');
		trackingEvents.forEach(function(element) {
			loadTrackingPixel(element['eventUrl']);
		});

		player.controlBar.progressControl.show();
		player.controlBar.currentTimeDisplay.show();
		player.controlBar.timeDivider.show();
		player.controlBar.durationDisplay.show();

		//enable fade out
		removeClass(player.controlBar.el(), 'vjs-manual-lock-showing');

		//remove overlay
		//TODO: Document isn't good if multiple player available
		player.el()
			.removeChild(document.getElementById('stage-overlay'));

		//stop interval and remove advertiser info
		clearInterval(_v.adPlayInterval)
		player.controlBar.el()
			.removeChild(document.getElementById('info-ad-time'));

		player.src(_v.mainTrack);
		if (adslot.getAdType() !== "post-roll") {
			player.play();
		}
		_v.currentSlot = null;
	};

	function playAd(adslot) {
		adslot.requestAd();
		if (adslot.isValid()){
			//call impression urls
			var impressionUrls = adslot.getImpressionUrls();
			impressionUrls.forEach(function(element) {
				loadTrackingPixel(element);
			});

			adslot.seen();

			//Count seen ads, not the fallback
			if (adslot.getAdType() === 'pre-roll') {
				_v.prerolls++;
			} else {
				_v.postrolls++;
			};

			if (!adslot.isFallbackAd()) {
				_v.currentSlot = adslot;

				//if maintrack was muted ad will also be muted, dont call tracking events for mute
				_v.muted = player.muted();

				//hide controls
				player.controlBar.progressControl.hide();
				player.controlBar.currentTimeDisplay.hide();
				player.controlBar.timeDivider.hide();
				player.controlBar.durationDisplay.hide();

				//TODO declare ad info string more central

				//TODO check if control bar is fadeout and fadein if needed

				//disable fade out
				addClass(player.controlBar.el(), 'vjs-manual-lock-showing');

				//overlay to deny show default controls by right click and to catch clicks
				var stageOverlay = document.createElement('a');
				player.el().appendChild(stageOverlay);
				stageOverlay.className = 'vjs-stage-overlay';
				stageOverlay.id = 'stage-overlay';
				stageOverlay.onclick = function() {
					adClick();
				};

				var advertiser = document.createElement('div');
				playerControl = player.controlBar;
				playerControl.el()
					.appendChild(advertiser);
				advertiser.innerHTML = "WERBUNG: Noch " + adslot.getDuration() + " Sekunden.";
				advertiser.className = 'vjs-info-ad-time';
				advertiser.id = 'info-ad-time';

				_v.mainTrack = player.currentSrc();
				player.src(adslot.getMediaFiles());

				//TODO: Coul be better
				//check if source is compatible
				var cnodes = player.el()
					.childNodes;
				for (var i in cnodes) {
					if (cnodes[i].innerHTML && cnodes[i].innerHTML.search("no compatible source and playback technology were found") != -1) {
						player.el()
							.removeChild(cnodes[i]);
						//call error event
						adError();
						return;
					}
				};

				//don't use timerupdate event from videojs because check every 15ms is too much
				_v.adPlayInterval = setInterval(function() {
					adTimer();
				},
				500);

				//call tracking event start
				var trackingEvents = _v.currentSlot.getTrackingEventUrls('start');
				trackingEvents.forEach(function(element) {
					loadTrackingPixel(element['eventUrl']);
				});
				player.play();
			}
		}else{
			console.log('DEBUG: No valid Ad found.');
		};
	};

	function adTimer() {
		//update duration string every second, 
		document.getElementById('info-ad-time')
			.innerHTML = "WERBUNG: Noch " + (_v.currentSlot.getDuration() - Math.ceil(player.currentTime())) + " Sekunden.";

		//check ad position to call Tracking events
		var curTime = player.currentTime();
		var duration = _v.currentSlot.getDuration()
		//check if video is loaded and duration is known
		if (duration && duration > 0) {
			if (curTime > duration / 4 && !_v.currentSlot.isTrackingEventFired('firstQuartile')) {
				var trackingEvents = _v.currentSlot.getTrackingEventUrls('firstQuartile');
				trackingEvents.forEach(function(element) {
					loadTrackingPixel(element['eventUrl']);
				});
				_v.currentSlot.trackingEventFired('firstQuartile');
			} else if (curTime > duration / 2 && !_v.currentSlot.isTrackingEventFired('midpoint')) {
				var trackingEvents = _v.currentSlot.getTrackingEventUrls('midpoint');
				trackingEvents.forEach(function(element) {
					loadTrackingPixel(element['eventUrl']);
				});
				_v.currentSlot.trackingEventFired('midpoint');
			} else if (curTime > duration / 1.5 && !_v.currentSlot.isTrackingEventFired('thirdQuartile')) {
				var trackingEvents = _v.currentSlot.getTrackingEventUrls('thirdQuartile');
				trackingEvents.forEach(function(element) {
					loadTrackingPixel(element['eventUrl']);
				});
				_v.currentSlot.trackingEventFired('thirdQuartile');
			};
		}
	};

	//pause player and open clickThrough url if possible

	function adClick() {
		//call tracking urls
		console.log('DEBUG: Ad clicked, call tracking urls');
		var clickTrackingUrls = _v.currentSlot.getClickTrackingUrls();
		clickTrackingUrls.forEach(function(element) {
			console.log('DEBUG: call: '+element);
			loadTrackingPixel(element);
		});

		//open new tab
		console.log('DEBUG: open target link');
		var url = _v.currentSlot.getClickThroughUrl();
		console.log('DEBUG: url: ' + url);
		if (isUrl(url)) {
			player.pause();
			console.log('DEBUG: player paused');
			var newTab = window.open(url, '_blank');
			console.log('DEBUG: window opened');
			newTab.focus();
			console.log('DEBUG: window focus');
		}
	};

	function loadTrackingPixel(url) {
		if (isUrl(url)) {
			trackingPixel = document.createElement('img');
			trackingPixel.style.visibility = "hidden";
			trackingPixel.style.position = "absolute";
			trackingPixel.style.width = "0px";
			trackingPixel.style.height = "0px";
			trackingPixel.src = url;
		}
	};

	function initAds(adObj) {
		_v.tempTime = 0;
		_v.adList = [];
		_v.mainTrack = player.currentSrc();
		_v.currentSlot = null;
		_v.api = '';
		_v.adPlayInterval = null;
		_v.muted = false;
		_v.fullScreen = false;
		_v.prerolls = 0;
		_v.postrolls = 0;

		try {
			//constructing list for further populating and sorting
			for (v in adObj.ads) {
				switch (adObj.ads[v].position) {

				case "pre-roll":
					_v.adList.push(new adSlot(adObj.ads[v].vastTagUrl, "pre-roll", 0));
					break;

				case "post-roll":
					_v.adList.push(new adSlot(adObj.ads[v].vastTagUrl, "post-roll", - 1));
					break;

				default:
					break;
				}
			}
		} catch (e) {
			console.log('VastInitAds::failed to create adslots: ' + e);
		}
	};

	function isUrl(s) {
		var regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
		return regexp.test(s);
	}

	function adSlot(_url, _type, _time) {
		var vastTagUrl = _url,
		 fallbackAd = false,
		 valid = false,
		 wrapperRedirects = 0,
		 type = _type,
		 time = _time,
		 source = "",
		 mime = "",
		 seen = false,
		 playOnce = true,
		 impressions = [],
		 trackingEvents = [],
		 link = "",
		 clickEvents = [],
		 errorEvents = [],
		 adId = "",
		 duration = "",
		 skipoffset = "",
		 mediaFiles = [],
		 clickThrough = "",
		 seen = false;
		var trackingEventsFired = {
			thirdQuartile: false,
			firstQuartile: false,
			midpoint: false
		};

		//requestAd(vastTagUrl);

		this.isFallbackAd = function() {
			return fallbackAd;
		};

		this.getAdId = function() {
			return adId;
		};

		this.isValid = function() {
			return valid;
		};

		this.isTrackingEventFired = function(eventName) {
			return trackingEventsFired[eventName];
		};

		this.trackingEventFired = function(eventName) {
			trackingEventsFired[eventName] = true;
		};

		this.getTrackingEventUrls = function(eventName) {
			var _events = [];
			for (var i = 0; i < trackingEvents.length; ++i) {
				if (trackingEvents[i].eventName == eventName){
					_events.push(trackingEvents[i]);
				}
			};
			return _events;
		};

		this.getClickThroughUrl = function() {
			return clickThrough;
		};

		this.getDuration = function() {
			return stringToSeconds(duration);
		};

		this.seen = function() {
			seen = true;
		};

		this.isSeen = function() {
			return seen;
		};

		this.getAdType = function() {
			return type;
		};

		this.getImpressionUrls = function() {
			var urls = [];
			impressions.forEach(function(element) {
				urls.push(replaceCacheBuster(element));
			});
			return urls;
		};

		this.getClickTrackingUrls = function() {
			var urls = [];
			clickEvents.forEach(function(element) {
				urls.push(replaceCacheBuster(element));
			});
			return urls;
		};

		this.getErrorTrackingUrls = function() {
			var urls = [];
			errorEvents.forEach(function(element) {
				urls.push(replaceCacheBuster(element));
			});
			return urls;
		};

		this.getMediaFiles = function() {
			var files = [];
			mediaFiles.forEach(function(element, index, array) {
				files.push({
					type: element.type,
					src: element.src
				});
			});
			return files;
		};

		this.requestAd = function() {
			_requestAd(vastTagUrl);
		};
		
		function _requestAd(_url) {
			url = replaceCacheBuster(_url);
			if (window.XMLHttpRequest) {
				var xhr = new XMLHttpRequest();
				xhr.open("GET", url, false);
				xhr.withCredentials = true;
				xhr.send(null);
				if (xhr.status == 200 && xhr.responseXML != null) {
					handleResult(xhr.responseText);
				}else{
					console.log("XHR error.");
				}
			} else {
				console.log('XHR not exist!');
			}
		};

		function handleResult(data) {
			// If our data is a string we need to parse it as XML
			if (typeof data === 'string') {
				// Clean everything before <?xml?> tag
				var xmlPosition = data.indexOf("<?xml");
				if (xmlPosition > 0) {
					var junk = data.substr(0, xmlPosition);
					data = data.replace(junk, '');
				}
				try {
					//data = $.parseXML(data);
					data = string2XML(data);
				} catch (error) {
					// error in parsing xml
					console.log("error in parsing xml");
				}
			}
			parseVast(data);
		};

		function string2XML(string) {
			if (!string) return false;

			var message = "";
			if (window.DOMParser) { // all browsers, except IE before version 9
				var parser = new DOMParser();
				try {
					xmlDoc = parser.parseFromString(string, "text/xml");
				} catch (e) {
					console.log("XML parsing error.");
					return false;
				};
			} else { // Internet Explorer before version 9
				if (typeof(ActiveXObject) == "undefined") {
					console.log("Cannot create XMLDocument object");
					return false;
				}
				ids = ["Msxml2.DOMDocument.6.0", "Msxml2.DOMDocument.5.0", "Msxml2.DOMDocument.4.0", "Msxml2.DOMDocument.3.0", "MSXML2.DOMDocument", "MSXML.DOMDocument"];
				for (var i = 0, il = ids.length; i < il; ++i) {
					try {
						xmlDoc = new ActiveXObject(ids[i]);
						break;
					} catch (e) {}
				}
				if (!xmlDoc) {
					console.log("Cannot create XMLDocument object");
					return false;
				}
				xmlDoc.loadXML(string);

				if (xmlDoc.parseError && xmlDoc.parseError.errorCode != 0) {
					console.log("XML Parsing Error: " + xmlDoc.parseError.reason + " at line " + xmlDoc.parseError.line + " at position " + xmlDoc.parseError.linepos);
					return false;
				} else {
					if (xmlDoc.documentElement) {
						if (xmlDoc.documentElement.nodeName == "parsererror") {
							console.log(xmlDoc.documentElement.childNodes[0].nodeValue);
						}
					} else {
						console.log("XML Parsing Error!");
					}
				}
			}
			return xmlDoc;
		};

		function foreach(arr, callback) {
			for (var k = 0; k < arr.length; k++) {
				callback(arr[k]);
			};
		};

		function trim(text) {
			return (text || "")
				.replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, "");
		};

		function parseVast(data) {
			var vastAds = data.querySelectorAll('Ad');
			for (var i = 0; i < vastAds.length; i++) {
				try {
					var vastAd = vastAds[i];

					//get AddId
					adId = vastAd.getAttribute('id');

					//get duration
					var vastDuration = vastAd.querySelector('duration,Duration');
					if (vastDuration) {
						duration = vastDuration.childNodes[0].nodeValue;
					};

					//get impression urls
					var vastImpressions = vastAd.querySelectorAll('Impression');
					if (vastImpressions && vastImpressions.length > 0) {
						for (var i_imp = 0; i_imp < vastImpressions.length; i_imp++) {
							var vastImpressionUrls = vastImpressions[i_imp].getElementsByTagName('URL');
							if (vastImpressionUrls && vastImpressionUrls.length > 0) {
								foreach(vastImpressionUrls, function(urlNode) {
									impressions.push(trim(decodeURIComponent(urlNode.childNodes[0].nodeValue))
										.replace(/^\<\!\-?\-?\[CDATA\[/, '')
										.replace(/\]\]\-?\-?\>/, ''));
								});
							} else {
								impressions.push(trim(decodeURIComponent(vastImpressions[i_imp].childNodes[0].nodeValue))
									.replace(/^\<\!\-?\-?\[CDATA\[/, '')
									.replace(/\]\]\-?\-?\>/, ''));
							};
						};
					};

					//get tracking events
					var vastTrackingEvents = vastAd.querySelectorAll("Linear > TrackingEvents > Tracking, InLine > TrackingEvents > Tracking, Wrapper > TrackingEvents > Tracking");
					if (vastTrackingEvents && vastTrackingEvents.length > 0) {
						for (var i_te = 0; i_te < vastTrackingEvents.length; i_te++) {
							var vastTrackingEventUrls = vastTrackingEvents[i_te].getElementsByTagName('URL');
							if (vastTrackingEventUrls && vastTrackingEventUrls.length > 0) {
								foreach(vastTrackingEventUrls, function(urlNode) {
									trackingEvents.push({
										'eventName': urlNode.parentNode.getAttribute('event'),
										'eventUrl': trim(decodeURIComponent(urlNode.childNodes[0].nodeValue))
											.replace(/^\<\!\-?\-?\[CDATA\[/, '')
											.replace(/\]\]\-?\-?\>/, '')
									});
								});
							} else {
								trackingEvents.push({
									'eventName': vastTrackingEvents[i_te].getAttribute('event'),
									'eventUrl': trim(decodeURIComponent(vastTrackingEvents[i_te].childNodes[0].nodeValue))
										.replace(/^\<\!\-?\-?\[CDATA\[/, '')
										.replace(/\]\]\-?\-?\>/, '')
								});
							};
						};
					};

					//get clicktracking urls
					var vastClickTrackings = vastAd.querySelectorAll('ClickTracking');
					if (vastClickTrackings && vastClickTrackings.length > 0) {
						for (var i_ct = 0; i_ct < vastClickTrackings.length; i_ct++) {
							var vastClickTrackingUrls = vastClickTrackings[i_ct].getElementsByTagName('URL');
							if (vastClickTrackingUrls && vastClickTrackingUrls.length > 0) {
								foreach(vastClickTrackingUrls, function(urlNode) {
									clickEvents.push(trim(decodeURIComponent(urlNode.childNodes[0].nodeValue))
										.replace(/^\<\!\-?\-?\[CDATA\[/, '')
										.replace(/\]\]\-?\-?\>/, ''));
								});
							} else {
								clickEvents.push(trim(decodeURIComponent(vastClickTrackings[i_ct].childNodes[0].nodeValue))
									.replace(/^\<\!\-?\-?\[CDATA\[/, '')
									.replace(/\]\]\-?\-?\>/, ''));
							};
						};
					};

					//get error urls
					var vastError = vastAd.querySelectorAll('Error');
					if (vastError && vastError.length > 0) {
						for (var i_err = 0; i_err < vastError.length; i_err++) {
							var vastErrorUrls = vastError[i_err].getElementsByTagName('URL');
							if (vastErrorUrls && vastErrorUrls.length > 0) {
								foreach(vastErrorUrls, function(urlNode) {
									errorEvents.push(trim(decodeURIComponent(urlNode.childNodes[0].nodeValue))
										.replace(/^\<\!\-?\-?\[CDATA\[/, '')
										.replace(/\]\]\-?\-?\>/, ''));
								});
							} else {
								errorEvents.push(trim(decodeURIComponent(vastError[i_err].childNodes[0].nodeValue))
									.replace(/^\<\!\-?\-?\[CDATA\[/, '')
									.replace(/\]\]\-?\-?\>/, ''));
							};
						};
					};

					//get media files
					var vastMediaFiles = vastAd.querySelectorAll('Linear > MediaFiles > MediaFile,Video > MediaFiles > MediaFile');
					if (vastMediaFiles && vastMediaFiles.length > 0) {
						for (var i_mf = 0; i_mf < vastMediaFiles.length; i_mf++) {
							var mediaFile = vastMediaFiles[i_mf];
							var type = mediaFile.getAttribute('type');
							// Normalize mp4 format:
							if (type == 'video/x-mp4' || type == 'video/h264') {
								type = 'video/mp4';
							}
							if (type == 'video/mp4' || type == 'video/ogg' || type == 'video/webm') {
								var mediaFileUrls = mediaFile.getElementsByTagName('URL');
								if (mediaFileUrls && mediaFileUrls.length > 0) {
									var srcFile = trim(decodeURIComponent(mediaFileUrls[0].childNodes[0].nodeValue))
										.replace(/^\<\!\-?\-?\[CDATA\[/, '')
										.replace(/\]\]\-?\-?\>/, '')
								} else {
									var srcFile = trim(decodeURIComponent(mediaFile.childNodes[0].nodeValue))
										.replace(/^\<\!\-?\-?\[CDATA\[/, '')
										.replace(/\]\]\-?\-?\>/, '')
								};
								var source = {
									'src': srcFile,
									'type': type
								};
								if (mediaFile.getAttribute('bitrate')) {
									source['data-bandwith'] = mediaFile.getAttribute('bitrate') * 1024;
								};
								if (mediaFile.getAttribute('width')) {
									source['data-width'] = mediaFile.getAttribute('width');
								};
								if (mediaFile.getAttribute('height')) {
									source['data-height'] = mediaFile.getAttribute('height');
								};
								// Add the source object:
								mediaFiles.push(source);
							}
						};
					};

					// Look for video click through
					var vastClickThrough = vastAd.querySelector('VideoClicks > ClickThrough');
					if (vastClickThrough) {
						var vastClickThroughUrls = vastClickThrough.getElementsByTagName('URL');
						if (vastClickThroughUrls && vastClickThroughUrls.length > 0) {
							clickThrough = trim(decodeURIComponent(vastClickThroughUrls[0].childNodes[0].nodeValue))
								.replace(/^\<\!\-?\-?\[CDATA\[/, '')
								.replace(/\]\]\-?\-?\>/, '');
						} else {
							clickThrough = trim(decodeURIComponent(vastClickThrough.childNodes[0].nodeValue))
								.replace(/^\<\!\-?\-?\[CDATA\[/, '')
								.replace(/\]\]\-?\-?\>/, '');
						}
					};

					//check if ad is fallback (advertiser special)
					var vastFallback = vastAd.querySelector('Extension > Fallback');
					if (vastFallback && vastFallback.childNodes[0].nodeValue === 'true') {
						fallbackAd = true;
					};

					// Check for Wrapper response
					var vastWrapper = vastAd.querySelector('Wrapper');
					if (vastWrapper) {
						var vastWrapperAdTagUrl = vastAd.querySelector('VASTAdTagURL,VASTAdTagURI');
						if (vastWrapperAdTagUrl) {
							if (wrapperRedirects < maxWrapperRedirects) {
								var vastWrapperAdTagUrls = vastWrapperAdTagUrl.getElementsByTagName('URL');
								if (vastWrapperAdTagUrls && vastWrapperAdTagUrls.length > 0) {
									_url = trim(decodeURIComponent(vastWrapperAdTagUrls[0].childNodes[0].nodeValue))
										.replace(/^\<\!\-?\-?\[CDATA\[/, '')
										.replace(/\]\]\-?\-?\>/, '');
								} else {
									_url = trim(decodeURIComponent(vastWrapperAdTagUrl.childNodes[0].nodeValue))
										.replace(/^\<\!\-?\-?\[CDATA\[/, '')
										.replace(/\]\]\-?\-?\>/, '');
								}
								console.log('VastAdParser:: Found vast wrapper, load ad: ' + _url);
								wrapperRedirects++;
								_requestAd(_url);
							} else {
								console.log('VastAdParser::maxWrapperRedirects reached. Skip ad.');
								valid = false;
							}
						}
					} else {
						if (mediaFiles.length > 0 || fallbackAd) {
							valid = true;
						} else {
							console.log('VastAdParser::no mediafiles available. Skip ad.');
						}
					};
				} catch (e) {
					console.log('Vastplugin::Error::ParsingXML:: ' + e);
				}
			};
		};

		function replaceCacheBuster(adUrl) {
			var cacheBusters = ['[timestamp]', '[cachebuster]', '[random]', '[randnum]'];
			var timestamp = Math.round(+new Date() / 1000) + Math.ceil(Math.random() * 1000);
			for (var i = 0; i < cacheBusters.length; i++) {
				adUrl = adUrl.replace(cacheBusters[i], timestamp);
			}
			return adUrl;
		};

		function stringToSeconds(timeString) {
			var seconds = timeString.substr(0, 1) * 3600 + timeString.substr(3, 2) * 60 + timeString.substr(6, 2) * 1;
			return seconds;
		};

	};
};

_V_.plugin('vastPlugin', vastPlugin);
