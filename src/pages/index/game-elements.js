import { LitElement, html } from "lit-element";
import { styleMap } from "lit-html/directives/style-map.js";
import { until } from "lit/directives/until.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { CHAT_COLOURS, EMOJIS, CUSTOM_EMOJIS } from "../../defaults.js";
import { sanitise, translate, hash, markdownParse } from "../../shared.js";

export class PositionIndicator extends HTMLElement {
	#root
	#x
	#y
	#zoom

	constructor() {
		super();
		this.#root = this.attachShadow({ mode: "closed" });
		this.#x = localStorage.x;
		this.#y = localStorage.y;
		this.#zoom = localStorage.z;
	}

	/**
	 * @param {number} x 
	 * @param {number} y 
	 * @param {number} z 
	 */
	setPosition(x, y, z) {
		this.#x = x;
		this.#y = y;
		this.#zoom = z;
		this.render();
	}

	render() {
		const displayedX = Math.floor(this.#x);
		const displayedY = Math.floor(this.#y);
		const displayedZoom = this.#zoom > 0.02 ? Math.round(this.#zoom * 50) / 10 : Math.ceil(this.#zoom * 500) / 100;
		this.#root.textContent = `(${displayedX},${displayedY}) ${displayedZoom}x`;
	}

	connectedCallback() {
		this.render();
	}
}
customElements.define("r-position-indicator", PositionIndicator);

export class LiveChatMouseEvent extends MouseEvent {
	/**@type {number}*/#messageId;
	/**@type {number}*/#senderId;

	/**
	 * @param {string} type
	 * @param {number} messageId
	 * @param {number} senderId
	 * @param {MouseEventInit} [eventInitDict]
	 */
	constructor(type, messageId, senderId, eventInitDict = {}) {
		super(type, eventInitDict);
		this.#messageId = messageId;
		this.#senderId = senderId;
	}

	/**
	 * @param {MouseEvent} sourceEvent
	 * @param {number} messageId
	 * @param {number} senderId
	 * @param {string} type
	 */
	static fromMouseEvent(sourceEvent, messageId, senderId, type) {
		return new LiveChatMouseEvent(type, messageId, senderId, {
			bubbles: sourceEvent.bubbles,
			cancelable: sourceEvent.cancelable,
			composed: sourceEvent.composed,
			detail: sourceEvent.detail,
			view: sourceEvent.view,
			which: sourceEvent.which,
			altKey: sourceEvent.altKey,
			button: sourceEvent.button,
			buttons: sourceEvent.buttons,
			clientX: sourceEvent.clientX,
			clientY: sourceEvent.clientY,
			ctrlKey: sourceEvent.ctrlKey,
			metaKey: sourceEvent.metaKey,
			movementX: sourceEvent.movementX,
			movementY: sourceEvent.movementY,
			relatedTarget: sourceEvent.relatedTarget,
			screenX: sourceEvent.screenX,
			screenY: sourceEvent.screenY,
			shiftKey: sourceEvent.shiftKey
		});
	}

	get messageId() {
		return this.#messageId;
	}

	get senderId() {
		return this.#senderId;
	}
}


export class LiveChatMessage extends LitElement {
	static properties = {
		messageId: { type: Number, reflect: true, attribute: "messageid" },
		senderId: { type: String, reflect: true, attribute: "senderid" },
		senderChatName: { type: String, reflect: true, attribute: "senderchatname" },
		sendDate: { type: Number, reflect: true, attribute: "senddate" },
		repliesTo: { type: Number, reflect: true, attribute: "repliesto" },
		content: { type: String, reflect: true, attribute: "content" },

		reactions: { type: Object, attribute: false },
		openedReactionDetails: { type: String, state: true, attribute: false },
		class: { reflect: true }
	};
	
	constructor() {
		super()
		/**@type {number}*/this.messageId = 0;
		/**@type {string}*/this.content = "";
		/**@type {number}*/this.senderIntId = 0;
		/**@type {string|null}*/this.senderChatName = null;
		/**@type {number}*/this.sendDate = 0;
		/**@type {number|null}*/this.repliesTo = null;
		/**@type {Map<string, Set<{ intId: number, chatName: string|null }>>|null}*/ this.reactions = null;
		/**@type {({senderChatName: string; content: string; fake?: boolean })|null}*/this.replyingMessage = null;
		
		this.openedReactionDetails = "";
		this.addEventListener("contextmenu", this.#notifyContextMenu);
	}

	connectedCallback() {
		super.connectedCallback();
		this.classList.add("message");
	}

	createRenderRoot() {
		return this;
	}

	/**
	 * @param {Map<any, any>} changedProperties
	 */
	willUpdate(changedProperties) {
		if (changedProperties.has("repliesTo") && this.repliesTo !== null) {
			this.replyingMessage = this.#findReplyingMessage()
		}
		if (changedProperties.has("class")) {
			this.classList.add("message")
		}
	}

	/**
	 * @param {string} message Raw message text
	 * @returns {Promise<any>} Lit HTML output
	 */
	async #parseMessage(message) {
		if (!message) {
			return null
		}

		message = sanitise(message);
		let parsedHTML = await markdownParse(message);

		// Handle emojis
		parsedHTML = parsedHTML.replaceAll(/:([a-z-_]{0,16}):/g, (full, source) => {
			const matches = parsedHTML.match(new RegExp(`:${source}:`, "g"));
			const isLargeEmoji = matches && matches.length === 1 && !parsedHTML.replace(full, "").trim();
			const size = isLargeEmoji ? "48" : "16"
			return `<img src="custom_emojis/${source}.png" alt=":${source}:" title=":${source}:" width="${size}" height="${size}">`;
		})	

		// Handle coordinates and generate final lit HTML
		const formattedMessage = this.#parseCoordinates(parsedHTML);
		return html`${formattedMessage}`
	}

	/**
	 * 
	 * @param {string} parsedHTML 
	 * @returns {any} Lit HTML fragment
	 */
	#parseCoordinates(parsedHTML) {
		const regex = /(\d+),\s*(\d+)/g // Matches coordinate patterns like "10, 20"
		const parts = []
		let lastIndex = 0

		for (const match of parsedHTML.matchAll(regex)) {
			const [fullMatch, x, y] = match
			const startIndex = match.index

			// Push the text before the match
			if (startIndex > lastIndex) {
				parts.push(unsafeHTML(parsedHTML.slice(lastIndex, startIndex)))
			}

			const href = `${window.location.pathname}?x=${x}&y=${y}`
			parts.push(html`<a href="${href}" @click=${(/**@type {MouseEvent}*/e) => 
				this.#notifyCoordinateClick(e, parseInt(x, 10), parseInt(y, 10))}>${x},${y}</a>`)

			lastIndex = startIndex + fullMatch.length
		}

		// Push any text following matches
		if (lastIndex < parsedHTML.length) {
			parts.push(unsafeHTML(parsedHTML.slice(lastIndex)))
		}

		return html`${parts}`
	}

	/**
	 * @returns {{ senderChatName: string; content: string; fake?: boolean } | null}
	 */
	#findReplyingMessage() {
		// TODO: Find a better way to do this, traversing the DOM to try and find the message we belong to is insane
		const message = /**@type {LiveChatMessage|undefined}*/(Array.from(this.parentElement?.children ?? [])
			.find(msgEl => msgEl instanceof LiveChatMessage && msgEl.messageId === this.repliesTo));
		if (!message) {
			// TODO: This is goofy as well
			const fakeMessage = {
				senderChatName: "[ERROR]",
				content: "...",
				fake: true
			};
			translate("messageNotFound").then(translated => fakeMessage.content = translated);
			return fakeMessage;
		}

		return message;
	}
	
	#scrollToReply() {
		if (!this.replyingMessage || this.replyingMessage.fake) {
			return
		}

		const reply = /**@type {LiveChatMessage}*/(this.replyingMessage);
		reply.setAttribute("highlight", "true");
		setTimeout(() => reply.removeAttribute("highlight"), 500);
		reply.scrollIntoView({ behavior: "smooth", block: "nearest" });
	}

	/**
	 * @param {MouseEvent} e
	 * @param {number} newX 
	 * @param {number} newY 
	 */
	#notifyCoordinateClick(e, newX, newY) {
		e.preventDefault();
		const coordinateClickEvent = new CustomEvent("coordinate-click", {
			bubbles: true,
			composed: true,
			detail: { x: newX, y: newY }
		});
		this.dispatchEvent(coordinateClickEvent);
	}

	/**
	 * @param {MouseEvent} e 
	 */
	#notifyNameClick(e) {
		e.preventDefault();
		const nameClickEvent = new CustomEvent("name-click", {
			bubbles: true,
			composed: true,
			detail: { messageId: this.messageId, senderId: this.senderIntId }
		});
		this.dispatchEvent(nameClickEvent);
	}
	
	/**
	 * @param {MouseEvent} e 
	 */
	#notifyContextMenu(e) {
		e.preventDefault();
		const contextMenuEvent = LiveChatMouseEvent.fromMouseEvent(e, this.messageId, this.senderIntId, "context-menu")
		this.dispatchEvent(contextMenuEvent);
	}

	/**
	 * @param {MouseEvent} e 
	 */
	#notifyReplyClick(e) {
		e.preventDefault();
		const replyClickEvent = new CustomEvent("reply-click", {
			bubbles: true,
			composed: true,
			detail: {
				messageId: this.messageId,
				senderId: this.senderIntId
			}
		});
		this.dispatchEvent(replyClickEvent);
	}

	/**
	 * @param {MouseEvent} e 
	 */
	#notifyReportClick(e) {
		e.preventDefault();
		const reportClickEvent = new CustomEvent("report-click", {
			bubbles: true,
			composed: true,
			detail: {
				messageId: this.messageId,
				senderId: this.senderIntId
			}
		});
		this.dispatchEvent(reportClickEvent);
	}

	/**
	 * @param {MouseEvent} e 
	 */
	#notifyModerateClick(e) {
		e.preventDefault();
		const moderateClickEvent = new CustomEvent("moderate-click", {
			bubbles: true,
			composed: true,
			detail: {
				messageId: this.messageId,
				senderId: this.senderIntId,
				messageElement: this
			}
		});
		this.dispatchEvent(moderateClickEvent);
	}

	/**
	 * @param {Event} e 
	 */
	#notifyReact(e) {
		e.preventDefault();
		const reactClickEvent = new CustomEvent("react-click", {
			bubbles: true,
			composed: true,
			detail: {
				messageId: this.messageId,
				senderId: this.senderIntId,
				messageElement: this
			}
		});
		this.dispatchEvent(reactClickEvent);
	}
	
	#renderName() {
		const nameStyle = {
			color: this.messageId === 0 ? undefined : CHAT_COLOURS[hash("" + this.senderIntId) & 7]
		}
		
		return html`
			<span 
				class="name ${this.messageId === 0 ? "rainbow-glow" : ""}" style=${styleMap(nameStyle)}
				title=${new Date(this.sendDate * 1000).toLocaleString()}
				@click=${this.#notifyNameClick}>[${this.senderChatName || ("#" + this.senderIntId)}]</span>`
	}
	
	#renderReply() {
		if (!this.repliesTo || !this.replyingMessage) {
			return null
		}
		
		return html`
			<p class="reply" @click=${this.#scrollToReply}>
				↪️ ${this.replyingMessage.senderChatName} ${this.replyingMessage.content}
			</p>`
	}
	
	#renderActions() {
		if (this.messageId <= 0) {
			return null
		}

		const renderActionButton = async (/**@type {string}*/src, /**@type {string}*/titleKey, /**@type {Function}*/clickHandler) => {
			const title = await translate(titleKey)
			return html`
				<img class="action-button icon-image" src="${src}"
					title="${title}" tabindex="0" @click="${clickHandler}">
			`
		}

		return html`
			<div class="actions">
				${until(renderActionButton("/svg/reply-action.svg", "replyTo", this.#notifyReplyClick), html`<span>...</span>`)}
				${until(renderActionButton("/svg/react-action.svg", "addReaction", this.#notifyReact), html`<span>...</span>`)}
				${until(renderActionButton("/svg/report-action.svg", "report", this.#notifyReportClick), html`<span>...</span>`)}
				${localStorage.vip?.startsWith("!") ? until(renderActionButton("svg/moderate-action.svg", "moderationOptionsAction", this.#notifyModerateClick), html`<span>Loading...</span>`) : null}
			</div>`
	}

	#renderReactions() {
		if (this.reactions == null) {
			return null
		}

		return html`
			<ul class="reactions">
				${this.reactions.entries().map(([emojiKey, reactors]) => {
					let emojiEl = null
					if (EMOJIS.has(emojiKey)) {
						emojiEl = html`<span class="emoji ${this.openedReactionDetails === emojiKey ? "expanded" : ""}">${EMOJIS.get(emojiKey)}</span>`
					}
					else if (CUSTOM_EMOJIS.has(emojiKey)) {
						emojiEl = html`<img src="custom_emojis/${emojiKey}.png" class="emoji ${this.openedReactionDetails === emojiKey ? "expanded" : ""}" alt=":${emojiKey}:" title=":${emojiKey}:" width="18" height="18">`
					}
					if (!emojiEl) {
						return null
					}
					return html`
						<li class="reaction ${this.openedReactionDetails == emojiKey ? "expanded" : ""}">
							<details class="reaction-details" ?open=${this.openedReactionDetails === emojiKey} @toggle=${(/**@type {Event}*/e) => {
								if (/**@type {HTMLDetailsElement}*/(e.target)?.open) {
									this.openedReactionDetails = emojiKey
								}
								else if (this.openedReactionDetails === emojiKey) {
									this.openedReactionDetails = ""
								}
							}}>
								<summary>
									<div class="emoji-container">
										${emojiEl}
										<span class="emoji-reactors-count">${reactors.size}</span>
										${this.openedReactionDetails == emojiKey ? html`<p>:${emojiKey}:</p>` : null}
									</div>
								</summary>
								<div class="reaction-body">
									<hr>
									<h3>${until(translate("addedBy"), "Added by:")}</h3>
									<ul class="reactors">
										${[...reactors].map((reactor) => html`
											<li class="reactor" title=${until(translate("userIdLabel").then((/**@type {string}*/label) => `${label} #${reactor.intId}`), "User ID: #" + reactor.intId)}>
												${reactor.chatName ?? "#" + reactor.intId}
											</li>
										`)}
									</ul>
								</div>
							</details>
						</li>`
				})}
			</ul>
		`
	}

	#renderMessage() {
		return html `<span class="content">${until(this.#parseMessage(this.content), html`...`)}</span>`
	}
		
	render() {
		return html`
			${this.#renderReply()}
			${this.#renderName()}
			${this.#renderMessage()}
			${this.#renderReactions()}
			${this.#renderActions()}`
	}
}
customElements.define("r-live-chat-message", LiveChatMessage);

export class PlaceChat extends LitElement {
	static properties = {
		positionIndex: { type: Number, reflect: true, attribute: "r-positionIndex" },
		content: { type: String, reflect: true, attribute: "r-content" },
		senderIntId: { type: Number, reflect: true, attribute: "r-senderIntId" },
		senderChatName: { type: String, reflect: true, attribute: "r-senderChatName" },
		sendDate: { type: Number, reflect: true, attribute: "r-sendDate" }
	}

	constructor() {
		super();
		/**@type {number}*/this.positionIndex = 0;
		/**@type {string}*/this.content = "";
		/**@type {number}*/this.senderIntId = 0;
		/**@type {string}*/this.senderChatName = "";
		/**@type {number}*/this.sendDate = Date.now(); 
	}

	createRenderRoot() {
		return this;
	}

	render() {
		return html`
			<div class="content">
				<span title="${(new Date(this.sendDate)).toLocaleString()}" style="color: ${CHAT_COLOURS[hash(String(this.senderIntId)) & 7]};">
					[${this.senderChatName}]
				</span>
				<span>
					${this.content}
				</span>
			</div>
			<div class="arrow"></div>`
	}
}
customElements.define("r-place-chat", PlaceChat);

export class PunishmentRecordElement extends LitElement {
	static properties = {
		record: { attribute:false },
		busy: { type:Boolean, state:true },
		response: { type:String, state:true },
		errorMessage: { type:String, state:true },
		labels: { attribute:false }
	};

	constructor() {
		super();
		/** @type {import("./moderation-api.js").PunishmentRecord|null} */
		this.record = null;
		this.busy = false;
		this.response = "";
		this.errorMessage = "";
		/** @type {Record<string, string>} */
		this.labels = {
			unknownModerator: "Unknown moderator",
			unknownPlayer: "Unknown player",
			unknownDate: "Unknown",
			expired: "Expired",
			active: "Active",
			punishment: "Punishment",
			user: "User",
			issuedBy: "Issued by",
			started: "Started",
			ends: "Ends",
			reason: "Reason",
			appeal: "Appeal",
			moderatorResponse: "Moderator response",
			explainDecision: "Explain the decision",
			approve: "Approve",
			deny: "Deny",
			noResponseRecorded: "No response was recorded.",
			responseTooLong: "Enter a response no longer than 1000 bytes."
		};
	}

	connectedCallback() {
		super.connectedCallback();
		this.setAttribute("role", "listitem");
		void this.#translateLabels();
	}

	async #translateLabels() {
		const keys = Object.keys(this.labels);
		const values = await Promise.all(keys.map(key => translate(key)));
		this.labels = Object.fromEntries(keys.map((key, index) => [key, values[index]]));
	}

	createRenderRoot() {
		return this;
	}

	/** @param {string|null} name @param {number|null} intId */
	#person(name, intId) {
		if (typeof intId !== "number" || !Number.isInteger(intId) || intId < 0) return this.labels.unknownModerator;
		return `${name || "anon"} (#${intId})`;
	}

	/** @param {number|null} value */
	#date(value) {
		return typeof value === "number" && Number.isFinite(value)
			? new Date(value).toLocaleString() : this.labels.unknownDate;
	}

	#status() {
		if (!this.record || this.record.finishDate <= Date.now()) return this.labels.expired;
		return this.labels.active;
	}

	/**
	 * @param {"left"|"right"} displaySide
	 * @param {string} content
	 * @param {number|null} date
	 * @param {number|null} senderIntId
	 * @param {string|null} senderChatName
	 * @param {string} unknownName
	 */
	#renderAppealMessage(displaySide, content, date, senderIntId, senderChatName, unknownName) {
		const knownSender = typeof senderIntId === "number" && Number.isInteger(senderIntId) && senderIntId >= 0;
		const sendDate = typeof date === "number" && Number.isFinite(date) ? date / 1000 : 0;
		return html`
			<r-live-chat-message
				data-display-side=${displaySide} data-explicit-time=${this.#date(date)}
				.messageId=${-1} .content=${content}
				.senderIntId=${knownSender ? senderIntId : -1}
				.senderChatName=${knownSender ? senderChatName : unknownName}
				.sendDate=${sendDate}>
			</r-live-chat-message>`;
	}

	/** @param {"approved"|"denied"} decision */
	#submit(decision) {
		if (!this.record) return;
		const response = this.response.trim();
		const byteLength = new TextEncoder().encode(response).byteLength;
		if (byteLength === 0 || byteLength > 1000) {
			this.errorMessage = this.labels.responseTooLong;
			return;
		}
		this.errorMessage = "";
		this.dispatchEvent(new CustomEvent("appeal-decision", {
			bubbles:true,
			composed:true,
			detail:{
				type:this.record.type,
				punishmentId:this.record.punishmentId,
				decision,
				response
			}
		}));
	}

	#renderAppeal() {
		if (!this.record?.appealMessage) return null;
		const pending = this.record.appealStatus === "pending";
		return html`
			<section class="punishment-appeal-review">
				<div class="chat-message-list appeal-conversation">
					${this.#renderAppealMessage("left", this.record.appealMessage,
						this.record.appealSubmittedAt, this.record.userIntId,
						this.record.userChatName, this.labels.unknownPlayer)}
					${pending ? null : this.#renderAppealMessage("right",
						this.record.appealResponse || this.labels.noResponseRecorded,
						this.record.appealRespondedAt, this.record.appealResponderIntId,
						this.record.appealResponderChatName, this.labels.unknownModerator)}
				</div>
				${pending ? html`
					<label class="appeal-response-field">
						<span>${this.labels.moderatorResponse}</span>
						<textarea .value=${this.response} ?disabled=${this.busy}
							@input=${(/** @type {InputEvent} */e) => {
								if (e.currentTarget instanceof HTMLTextAreaElement) this.response = e.currentTarget.value;
								this.errorMessage = "";
							}}
							placeholder=${this.labels.explainDecision} maxlength="1000"></textarea>
					</label>
					${this.errorMessage ? html`<p class="appeal-error" role="alert">${this.errorMessage}</p>` : null}
					<div class="appeal-decision-actions">
						<button type="button" class="appeal-approve" ?disabled=${this.busy}
							@click=${() => this.#submit("approved")}>${this.labels.approve}</button>
						<button type="button" class="appeal-deny" ?disabled=${this.busy}
							@click=${() => this.#submit("denied")}>${this.labels.deny}</button>
					</div>` : html`
					<p class="appeal-decision appeal-decision-${this.record.appealStatus}">
						${this.labels.appeal} ${this.record.appealStatus}
					</p>`}
			</section>`;
	}

	#renderSummary() {
		if (!this.record) return null;
		return html`
			<div class="punishment-record-summary">
				<div>
					<span class="punishment-record-label">${this.record.type}</span>
					<strong>${this.labels.punishment} #${this.record.punishmentId}</strong>
					<span class="punishment-record-state ${this.#status().toLowerCase()}">${this.#status()}</span>
				</div>
				<dl>
					<div><dt>${this.labels.user}</dt><dd>${this.#person(this.record.userChatName, this.record.userIntId)}</dd></div>
					<div><dt>${this.labels.issuedBy}</dt><dd>${this.#person(this.record.moderatorChatName, this.record.moderatorIntId)}</dd></div>
					<div><dt>${this.labels.started}</dt><dd>${this.#date(this.record.startDate)}</dd></div>
					<div><dt>${this.labels.ends}</dt><dd>${this.#date(this.record.finishDate)}</dd></div>
				</dl>
				<div class="punishment-record-reason"><strong>${this.labels.reason}</strong><p>${this.record.reason}</p></div>
			</div>`;
	}

	render() {
		if (!this.record) return null;
		const summary = this.#renderSummary();
		if (this.record.appealMessage) {
			return html`
				<details class="punishment-record-card">
					<summary>${summary}</summary>
					${this.#renderAppeal()}
				</details>`;
		}
		return html`
			<article class="punishment-record-card">
				${summary}
			</article>`;
	}
}
customElements.define("r-punishment-record", PunishmentRecordElement);
