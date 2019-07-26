import * as _ from 'underscore'
// import * as underScoreDeepExtend from 'underscore-deep-extend'
import { TimelineState } from 'superfly-timeline'
import {
	DeviceWithState,
	CommandWithContext,
	DeviceStatus,
	StatusCode
} from './device'
import {
	DeviceType,
	DeviceOptions,
	TimelineContentTypeHyperdeck,
	MappingHyperdeck,
	MappingHyperdeckType,
	HyperdeckOptions,
	TimelineObjHyperdeckTransport,
	TimelineObjHyperdeckAny
} from '../types/src'
import {
	Hyperdeck,
	Commands as HyperdeckCommands,
	TransportStatus
} from 'hyperdeck-connection'
import { DoOnTime, SendMode } from '../doOnTime'

// _.mixin({ deepExtend: underScoreDeepExtend(_) })
// function deepExtend<T> (destination: T, ...sources: any[]) {
// 	// @ts-ignore (mixin)
// 	return _.deepExtend(destination, ...sources)
// }
export interface HyperdeckDeviceOptions extends DeviceOptions {
	options?: {
		commandReceiver?: CommandReceiver
	}
}
export type CommandReceiver = (time: number, command: HyperdeckCommands.AbstractCommand, context: CommandContext, timelineObjId: string) => Promise<any>
export interface HyperdeckCommandWithContext {
	command: HyperdeckCommands.AbstractCommand
	context: CommandContext
	timelineObjId: string
}

export interface TransportInfoCommandResponseExt {
	status: TransportStatus
	recordFilename?: string
}

export interface DeviceState {
	notify: HyperdeckCommands.NotifyCommandResponse
	transport: TransportInfoCommandResponseExt
	/** The timelineObject this state originates from */
	timelineObjId: string
}

type CommandContext = any
/**
 * This is a wrapper for the Hyperdeck Device. Commands to any and all hyperdeck devices will be sent through here.
 */
export class HyperdeckDevice extends DeviceWithState<DeviceState> {

	private _doOnTime: DoOnTime

	private _hyperdeck: Hyperdeck
	private _initialized: boolean = false
	private _connected: boolean = false

	private _recordingTime: number
	private _minRecordingTime: number // 15 minutes
	private _recTimePollTimer: NodeJS.Timer

	private _commandReceiver: CommandReceiver

	constructor (deviceId: string, deviceOptions: HyperdeckDeviceOptions, options) {
		super(deviceId, deviceOptions, options)
		if (deviceOptions.options) {
			if (deviceOptions.options.commandReceiver) this._commandReceiver = deviceOptions.options.commandReceiver
			else this._commandReceiver = this._defaultCommandReceiver
		}
		this._doOnTime = new DoOnTime(() => {
			return this.getCurrentTime()
		}, SendMode.BURST, this._deviceOptions)
		this._doOnTime.on('error', e => this.emit('error', 'Hyperdeck.doOnTime', e))
		this._doOnTime.on('slowCommand', msg => this.emit('slowCommand', this.deviceName + ': ' + msg))
	}

	/**
	 * Initiates the connection with the Hyperdeck through the hyperdeck-connection lib.
	 */
	init (options: HyperdeckOptions): Promise<boolean> {
		return new Promise((resolve/*, reject*/) => {
			let firstConnect = true

			this._hyperdeck = new Hyperdeck({ pingPeriod: 1000 })
			this._hyperdeck.connect(options.host, options.port)
			this._hyperdeck.on('connected', () => {
				this._queryCurrentState()
				.then(async (state) => {

					this.setState(state, this.getCurrentTime())
					if (firstConnect) {
						firstConnect = false
						this._initialized = true
						resolve(true)
					}
					this._connected = true
					this._connectionChanged()
					this.emit('resetResolver')
				})
				.catch(e => this.emit('error', 'Hyperdeck.on("connected")', e))

				if (options.minRecordingTime) {
					this._minRecordingTime = options.minRecordingTime
					if (this._recTimePollTimer) clearTimeout(this._recTimePollTimer)
					this._queryRecordingTime()
				}
			})
			this._hyperdeck.on('disconnected', () => {
				this._connected = false
				this._connectionChanged()
			})
			this._hyperdeck.on('error', (e) => this.emit('error', 'Hyperdeck', e))
		})
	}
	/**
	 * Makes this device ready for garbage collection.
	 */
	terminate (): Promise<boolean> {
		this._doOnTime.dispose()
		if (this._recTimePollTimer) clearTimeout(this._recTimePollTimer)

		return new Promise((resolve) => {
			// TODO: implement dispose function in hyperdeck-connection
			// this._hyperdeck.dispose()
			// .then(() => {
			// resolve(true)
			// })
			resolve(true)
		})
	}

	/**
	 * Prepares device for playout
	 */
	async makeReady (okToDestroyStuff?: boolean): Promise<void> {
		if (okToDestroyStuff) {
			let time = this.getCurrentTime()
			this._doOnTime.clearQueueNowAndAfter(time)

			// TODO - could this being slow/offline be a problem?
			let state = await this._queryCurrentState()

			this.setState(state, time)
		}
	}

	/**
	 * 
	 */
	async formatDisks () {
		const confirmation = await this._hyperdeck.sendCommand(new HyperdeckCommands.FormatCommand())

		const formatCmd = new HyperdeckCommands.FormatConfirmCommand()
		formatCmd.code = confirmation.code
		return this._hyperdeck.sendCommand(formatCmd)
	}

	/**
	 * Saves and handles state at specified point in time such that the device will be in
	 * that state at that time.
	 * @param newState
	 */
	handleState (newState: TimelineState) {
		if (!this._initialized) {
			// before it's initialized don't do anything
			this.emit('info', 'Hyperdeck not initialized yet')
			return
		}

		// Create device states
		let previousStateTime = Math.max(this.getCurrentTime(), newState.time)
		let oldState: DeviceState = (this.getStateBefore(previousStateTime) || { state: this._getDefaultState() }).state

		let oldHyperdeckState = oldState
		let newHyperdeckState = this.convertStateToHyperdeck(newState)

		// Generate commands to transition to new state
		let commandsToAchieveState: Array<HyperdeckCommandWithContext> = this._diffStates(oldHyperdeckState, newHyperdeckState)

		// clear any queued commands later than this time:
		this._doOnTime.clearQueueNowAndAfter(previousStateTime)
		// add the new commands to the queue:
		this._addToQueue(commandsToAchieveState, newState.time)

		// store the new state, for later use:
		this.setState(newHyperdeckState, newState.time)
	}
	/**
	 * Clears any scheduled commands after this time
	 * @param clearAfterTime
	 */
	clearFuture (clearAfterTime: number) {
		this._doOnTime.clearQueueAfter(clearAfterTime)
	}
	get canConnect (): boolean {
		return true
	}
	get connected (): boolean {
		return this._connected
	}
	/**
	 * Converts a timeline state to a device state.
	 * @param state
	 */
	convertStateToHyperdeck (state: TimelineState): DeviceState {
		if (!this._initialized) throw Error('convertStateToHyperdeck cannot be used before inititialized')

		// Convert the timeline state into something we can use easier:
		const deviceState = this._getDefaultState()

		const sortedLayers = _.map(state.layers, (tlObject, layerName) => ({ layerName, tlObject }))
			.sort((a, b) => a.layerName.localeCompare(b.layerName))
		_.each(sortedLayers, ({ tlObject, layerName }) => {

			const hyperdeckObj = tlObject as any as TimelineObjHyperdeckAny

			const mapping = this.getMapping()[layerName] as MappingHyperdeck

			if (mapping) {
				switch (mapping.mappingType) {
					case MappingHyperdeckType.TRANSPORT:
						if (hyperdeckObj.content.type === TimelineContentTypeHyperdeck.TRANSPORT) {
							const hyperdeckObjTransport = tlObject as any as TimelineObjHyperdeckTransport
							if (!deviceState.transport) {
								deviceState.transport = {
									status: 		hyperdeckObjTransport.content.status,
									recordFilename: hyperdeckObjTransport.content.recordFilename
								}
							}

							deviceState.transport.status			= hyperdeckObjTransport.content.status
							deviceState.transport.recordFilename	= hyperdeckObjTransport.content.recordFilename
						}
						break
				}
			}
		})
		return deviceState
	}
	get deviceType () {
		return DeviceType.HYPERDECK
	}
	get deviceName (): string {
		return 'Hyperdeck ' + this.deviceId
	}
	get queue () {
		return this._doOnTime.getQueue()
	}
	getStatus (): DeviceStatus {
		// TODO: add status check here, to set warning if we've set it to record, but it's not
		let statusCode = StatusCode.GOOD
		let messages: Array<string> = []

		if (!this._connected) statusCode = StatusCode.BAD

		if (this._recordingTime < this._minRecordingTime && this._connected && this._minRecordingTime) {
			if (this._recordingTime === 0) {
				statusCode = StatusCode.BAD
			} else {
				statusCode = StatusCode.WARNING_MAJOR
			}
			let t = `${Math.floor(this._recordingTime / 60)} minutes and ${this._recordingTime % 60} seconds`
			messages.push('Recording time left is less than ' + t)
		}

		return {
			statusCode,
			messages
		}
	}
	private _addToQueue (commandsToAchieveState: Array<HyperdeckCommandWithContext>, time: number) {
		_.each(commandsToAchieveState, (cmd: HyperdeckCommandWithContext) => {
			// add the new commands to the queue:
			this._doOnTime.queue(time, undefined, (cmd: HyperdeckCommandWithContext) => {
				return this._commandReceiver(time, cmd.command, cmd.context, cmd.timelineObjId)
			}, cmd)
		})
	}

	/**
	 * Generates commands to transition from old to new state.
	 * @param oldHyperdeckState The assumed current state
	 * @param newHyperdeckState The desired state of the device
	 */
	private _diffStates (oldHyperdeckState: DeviceState, newHyperdeckState: DeviceState): Array<HyperdeckCommandWithContext> {
		const commandsToAchieveState: HyperdeckCommandWithContext[] = []

		if (oldHyperdeckState.notify && newHyperdeckState.notify) {
			const notifyCmd = new HyperdeckCommands.NotifySetCommand()
			let hasChange: {
				timelineObjId: string
			} | null = null

			const keys = _.unique(_.keys(oldHyperdeckState.notify).concat(_.keys(newHyperdeckState.notify)))
			for (let k of keys) {
				if (oldHyperdeckState.notify[k] !== newHyperdeckState.notify[k]) {
					notifyCmd[k] = newHyperdeckState.notify[k]
					hasChange = {
						timelineObjId: newHyperdeckState.timelineObjId
					}
				}
			}

			if (hasChange) {
				commandsToAchieveState.push({
					command: notifyCmd,
					context: {
						oldState: oldHyperdeckState.notify,
						newState: newHyperdeckState.notify
					},
					timelineObjId: hasChange.timelineObjId
				})
			}
		} else {
			this.emit('error', 'Hyperdeck', new Error(`diffStates missing notify object: ${JSON.stringify(oldHyperdeckState.notify)}, ${JSON.stringify(newHyperdeckState.notify)}`))
		}

		if (oldHyperdeckState.transport && newHyperdeckState.transport) {
			switch (newHyperdeckState.transport.status) {
				case TransportStatus.RECORD:
					// TODO - sometimes we can loose track of the filename (eg on reconnect).
					// should we split the record when recovering from that? (it might loose some frames)
					const filenameChanged = oldHyperdeckState.transport.recordFilename !== undefined &&
						oldHyperdeckState.transport.recordFilename !== newHyperdeckState.transport.recordFilename

					if (oldHyperdeckState.transport.status !== newHyperdeckState.transport.status) { // Start recording
						commandsToAchieveState.push({
							command: new HyperdeckCommands.RecordCommand(newHyperdeckState.transport.recordFilename),
							context: {
								oldState: oldHyperdeckState.transport,
								newState: newHyperdeckState.transport
							},
							timelineObjId: newHyperdeckState.timelineObjId
						})
					} else if (filenameChanged) { // Split recording
						commandsToAchieveState.push({
							command: new HyperdeckCommands.StopCommand(),
							context: {
								oldState: oldHyperdeckState.transport,
								newState: newHyperdeckState.transport
							},
							timelineObjId: newHyperdeckState.timelineObjId
						})
						commandsToAchieveState.push({
							command: new HyperdeckCommands.RecordCommand(newHyperdeckState.transport.recordFilename),
							context: {
								oldState: oldHyperdeckState.transport,
								newState: newHyperdeckState.transport
							},
							timelineObjId: newHyperdeckState.timelineObjId
						})
					} // else continue recording

					break
				default:
					// TODO - warn
					// for now we are assuming they want a stop. that could be conditional later on
					if (oldHyperdeckState.transport.status === TransportStatus.RECORD) {
						commandsToAchieveState.push({
							command: new HyperdeckCommands.StopCommand(),
							context: {
								oldState: oldHyperdeckState.transport,
								newState: newHyperdeckState.transport
							},
							timelineObjId: newHyperdeckState.timelineObjId
						})
					}
					break
			}

		} else {
			this.emit('error', 'Hyperdeck', new Error(`diffStates missing transport object: ${JSON.stringify(oldHyperdeckState.transport)}, ${JSON.stringify(newHyperdeckState.transport)}`))
		}

		return commandsToAchieveState
	}

	/**
	 * Gets the current state of the device
	 */
	private async _queryCurrentState (): Promise<DeviceState> {
		if (!this._connected) return this._getDefaultState()

		const notify = this._hyperdeck.sendCommand(new HyperdeckCommands.NotifyGetCommand())
		const transport = this._hyperdeck.sendCommand(new HyperdeckCommands.TransportInfoCommand())

		const notifyRes = await notify
		const transportRes = await transport

		const res: DeviceState = {
			notify: notifyRes,
			transport: transportRes,
			timelineObjId: 'currentState'
		}
		return res
	}

	/**
	 * Queries the recording time left in seconds of the device and mutates
	 * this._recordingTime
	 */
	private async _queryRecordingTime (): Promise<void> {
		let time = 0

		for (let slot = 1; true; slot++) {
			try {
				const res = await this._hyperdeck.sendCommand(new HyperdeckCommands.SlotInfoCommand(slot))
				time += res.recordingTime
			} catch (e) {
				break
			}
		}

		this._recordingTime = time

		this._recTimePollTimer = setTimeout(() => {
			this._queryRecordingTime()
		}, Math.max(time / 2, 10) * 1000)
	}

	/**
	 * Gets the default state of the device
	 */
	private _getDefaultState (): DeviceState {
		const res: DeviceState = {
			notify: { // TODO - this notify block will want configuring per device or will the state lib always want it the same?
				remote: false,
				transport: false,
				slot: false,
				configuration: false,
				droppedFrames: false
			},
			transport: {
				status: TransportStatus.PREVIEW
			},
			timelineObjId: ''
		}

		return res
	}

	private _defaultCommandReceiver (_time: number, command: HyperdeckCommands.AbstractCommand, context: CommandContext, timelineObjId: string): Promise<any> {
		let cwc: CommandWithContext = {
			context: context,
			timelineObjId: timelineObjId,
			command: command
		}
		this.emit('debug', cwc)

		return this._hyperdeck.sendCommand(command)
		.catch(error => {
			this.emit('commandError', error, cwc)
		})
	}
	private _connectionChanged () {
		this.emit('connectionChanged', this.getStatus())
	}
}
