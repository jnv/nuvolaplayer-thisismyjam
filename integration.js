/* jshint indent:4 */
/*
 * Copyright 2011-2013 Jiří Janoušek <janousek.jiri@gmail.com>
 * Copyright 2014 Jan Vlnas <pgp@jan.vlnas.cz>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/* Anonymous function is used not to pollute environment */
(function(Nuvola) {

	if (Nuvola.checkFlash)
		Nuvola.checkFlash();

	/**
	 * Generate element selection function
	 */
	var elementSelector = function() {
		var ELEM_IDS = {
			prev: 'backwards',
			next: 'forwards',
			song: 'track-title',
			artist: 'artist-name',
			play: 'playPause',
			thumbsUp: 'controlLike',
			playAll: 'playAllJams'
		};

		return function(type) {
			return document.getElementById(ELEM_IDS[type]);
		};
	};

	var getElement = elementSelector();

	/**
	 * Returns {prev: bool, next: bool}
	 **/
	var getPlaylistState = function() {
		var ret = {};
		['prev', 'next'].forEach(function(type) {
			ret[type] = !getElement(type).hasAttribute('disabled');
		});
		return ret;
	};

	/**
	 * Return an URL of the image of (hopefully) currently playing track
	 * TODO: store the first found album art with the currently playing track,
	 *       so the visiting the profile page does not replace a correct album art
	 *       - OTOH, if I am playing a playlist and I am on the profile page, the incorrect
	 *       art will be loaded and stored
	 **/
	var getArtLocation = function() {
		var img = null;
		// On Playlist page, things are easy
		img = document.querySelector('.blackHole.playing img');
		if (img) {
			return img.getAttribute('data-thumb');
		}
		// Let's try profile page
		img = document.querySelector('#jamHolder img');
		if (img) {
			return img.src;
		}

		// No can do
		return null;
	};

	/**
	 * Return state depending on the play button
	 */
	var getState = function() {
		var el = getElement('play');

		if (!el) {
			return Nuvola.STATE_NONE;
		}

		if (el.className.match(/playing$/)) {
			return Nuvola.STATE_PLAYING;
		}
		else if (el.className.match(/paused$/)) {
			return Nuvola.STATE_PAUSED;
		}

		return Nuvola.STATE_NONE;
	};

	var doPlay = function() {
		var play = getElement('play');
		if (play && (getState() != Nuvola.STATE_NONE)) {
			Nuvola.clickOnElement(play);
			return true;
		}
		var playAll = getElement('playAll');
		if (playAll) {
			Nuvola.clickOnElement(playAll);
			return true;
		}
		return false;
	};


	/**
	 * Creates integration bound to Nuvola JS API
	 */
	var Integration = function() {
		/* Overwrite default commnad function */
		Nuvola.onMessageReceived = Nuvola.bind(this, this.messageHandler);

		/* For debug output */
		this.name = "thisismyjam";

		/* Let's run */
		this.state = Nuvola.STATE_NONE;
		this.can_thumbs_up = null;
		this.can_thumbs_down = null;
		this.can_prev = null;
		this.can_next = null;
		this.update();
	};

	/**
	 * Updates current playback state
	 */
	Integration.prototype.update = function() {
		// Default values
		var state = Nuvola.STATE_NONE;
		var can_prev = false;
		var can_next = false;
		var can_thumbs_up = false;
		var can_thumbs_down = false;
		var album_art = null;
		var song = null;
		var artist = null;

		try {
			state = getState();
			song = getElement('song').textContent;
			artist = getElement('artist').textContent;
			album_art = getArtLocation();
			can_thumbs_up = (state !== Nuvola.STATE_NONE);

			var playlist = getPlaylistState();
			can_prev = playlist.prev;
			can_next = playlist.next;
			// can_thumbs_down = false;
		}
		catch (x) {
			song = artist = null;
		}

		// Save state
		this.state = state;

		// Submit data to Nuvola backend
		Nuvola.updateSong(song, artist, null, album_art, state);

		// Update actions
		if (this.can_prev !== can_prev) {
			this.can_prev = can_prev;
			Nuvola.updateAction(Nuvola.ACTION_PREV_SONG, can_prev);
		}
		if (this.can_next !== can_next) {
			this.can_next = can_next;
			Nuvola.updateAction(Nuvola.ACTION_NEXT_SONG, can_next);
		}
		if (this.can_thumbs_up !== can_thumbs_up) {
			this.can_thumbs_up = can_thumbs_up;
			Nuvola.updateAction(Nuvola.ACTION_THUMBS_UP, can_thumbs_up);
		}
		if (this.can_thumbs_down !== can_thumbs_down) {
			this.can_thumbs_down = can_thumbs_down;
			Nuvola.updateAction(Nuvola.ACTION_THUMBS_DOWN, can_thumbs_down);
		}

		// Schedule update
		setTimeout(Nuvola.bind(this, this.update), 500);
	};

	/**
	 * Message handler
	 * @param cmd command to execute
	 */
	Integration.prototype.messageHandler = function(cmd) {
		/* Respond to user actions */
		try {
			switch (cmd) {
				case Nuvola.ACTION_PLAY:
					if (this.state != Nuvola.STATE_PLAYING)
						doPlay();
					break;
				case Nuvola.ACTION_PAUSE:
					if (this.state == Nuvola.STATE_PLAYING)
						Nuvola.clickOnElement(getElement('play'));
					break;
				case Nuvola.ACTION_TOGGLE_PLAY:
					doPlay();
					break;
				case Nuvola.ACTION_PREV_SONG:
					Nuvola.clickOnElement(getElement('prev'));
					break;
				case Nuvola.ACTION_NEXT_SONG:
					Nuvola.clickOnElement(getElement('next'));
					break;
				case Nuvola.ACTION_THUMBS_UP:
					Nuvola.clickOnElement(getElement('thumbsUp'));
					break;
					/*case Nuvola.ACTION_THUMBS_DOWN:
				break;*/
				default:
					// Other commands are not supported
					throw {
						"message": "Not supported."
					};
			}
			console.log(this.name + ": comand '" + cmd + "' executed.");
		}
		catch (e) {
			// Older API expected exception to be a string.
			throw (this.name + ": " + e.message);
		}
	};

	/* Store reference */
	Nuvola.integration = new Integration(); // Singleton

	// Immediately call the anonymous function with Nuvola JS API main object as an argument.
	// Note that "this" is set to the Nuvola JS API main object.
})(this);
