import { Conductor } from '../../conductor'
import {
	TimelineContentTypeCasparCg,
	MappingCasparCG,
	Mappings,
	DeviceType,
	ChannelFormat,
	Transition,
	Ease,
	Direction
} from '../../types/src'
import { MockTime } from '../../__tests__/mockTime'
import { getMockCall } from '../../__tests__/lib'

// usage logCalls(commandReceiver0)
// function logCalls (fcn) {
// 	console.log('calls')
// 	fcn.mock.calls.forEach((call) => {
// 		console.log(call[0], call[1])
// 	})
// }

describe('CasparCG', () => {
	let mockTime = new MockTime()
	beforeAll(() => {
		mockTime.mockDateNow()
	})
	beforeEach(() => {
		mockTime.init()
	})
	test('CasparCG: Play AMB for 60s', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 2,
			layer: 42
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		await myConductor.init() // we cannot do an await, because setTimeout will never call without jest moving on.
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				useScheduling: true
			}
		})
		await myConductor.setMapping(myLayerMapping)
		await mockTime.advanceTimeToTicks(10100)

		expect(commandReceiver0).toHaveBeenCalledTimes(3)

		expect(getMockCall(commandReceiver0, 0, 1)._objectParams).toMatchObject({ channel: 1, timecode: '00:00:10:00' })
		expect(getMockCall(commandReceiver0, 1, 1)._objectParams).toMatchObject({ channel: 2, timecode: '00:00:10:00' })
		expect(getMockCall(commandReceiver0, 2, 1)._objectParams).toMatchObject({ channel: 3, timecode: '00:00:10:00' })

		commandReceiver0.mockClear()

		let deviceContainer = myConductor.getDevice('myCCG')
		let device = deviceContainer.device

		// Check that no commands has been scheduled:
		expect(await device['queue']).toHaveLength(0)

		myConductor.timeline = [
			{
				id: 'obj0',
				enable: {
					start: mockTime.getCurrentTime() - 1000, // 1 seconds ago
					duration: 2000
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.MEDIA,

					file: 'AMB',
					loop: true
				}
			}
		]

		await mockTime.advanceTimeToTicks(10200)

		// one command has been sent:
		expect(commandReceiver0).toHaveBeenCalledTimes(2)
		expect(getMockCall(commandReceiver0, 0, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			noClear: false,
			clip: 'AMB',
			loop: true,
			seek: 0 // looping and seeking nos supported when length not provided
		})

		// advance time to end of clip:
		await mockTime.advanceTimeToTicks(11200)

		// two commands have been sent:
		expect(commandReceiver0).toHaveBeenCalledTimes(2)
		expect(getMockCall(commandReceiver0, 1, 1).name).toEqual('ScheduleSetCommand')
		expect(getMockCall(commandReceiver0, 1, 1)._objectParams.command.name).toEqual('ClearCommand')
		expect(getMockCall(commandReceiver0, 1, 1)._objectParams.command.channel).toEqual(2)
		expect(getMockCall(commandReceiver0, 1, 1)._objectParams.command.layer).toEqual(42)
	})
	test('CasparCG: Play AMB for 60s, start at 10s', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 2,
			layer: 42
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		await myConductor.init() // we cannot do an await, because setTimeout will never call without jest moving on.
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				useScheduling: true
			}
		})
		await myConductor.setMapping(myLayerMapping)
		await mockTime.advanceTimeToTicks(10100)

		expect(commandReceiver0).toHaveBeenCalledTimes(3)

		expect(getMockCall(commandReceiver0, 0, 1)._objectParams).toMatchObject({ channel: 1, timecode: '00:00:10:00' })
		expect(getMockCall(commandReceiver0, 1, 1)._objectParams).toMatchObject({ channel: 2, timecode: '00:00:10:00' })
		expect(getMockCall(commandReceiver0, 2, 1)._objectParams).toMatchObject({ channel: 3, timecode: '00:00:10:00' })

		commandReceiver0.mockClear()

		let deviceContainer = myConductor.getDevice('myCCG')
		let device = deviceContainer.device

		// Check that no commands has been scheduled:
		expect(await device['queue']).toHaveLength(0)

		myConductor.timeline = [
			{
				id: 'obj0',
				enable: {
					start: mockTime.getCurrentTime() - 10000, // 10 seconds ago
					duration: 60000
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.MEDIA,

					file: 'AMB'
				}
			}
		]

		await mockTime.advanceTimeToTicks(10200)

		// one command has been sent:
		expect(commandReceiver0).toHaveBeenCalledTimes(1)
		expect(getMockCall(commandReceiver0, 0, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			noClear: false,
			clip: 'AMB',
			seek: 25 * 10
		})
	})

	test('CasparCG: Play IP input for 60s', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 2,
			layer: 42
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		await myConductor.init()
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				useScheduling: false
			}
		})
		await myConductor.setMapping(myLayerMapping)

		let deviceContainer = myConductor.getDevice('myCCG')
		let device = deviceContainer.device

		// Check that no commands has been scheduled:
		expect(await device['queue']).toHaveLength(0)
		myConductor.timeline = [
			{
				id: 'obj0',
				enable: {
					start: mockTime.getCurrentTime() - 1000, // 1 seconds ago
					duration: 2000
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.IP,

					uri: 'rtsp://127.0.0.1:5004'
				}
			}
		]
		await mockTime.advanceTimeTicks(100)

		// one command has been sent:
		expect(commandReceiver0).toHaveBeenCalledTimes(1)
		expect(getMockCall(commandReceiver0, 0, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			noClear: false,
			clip: 'rtsp://127.0.0.1:5004',
			seek: 0 // can't seek in an ip input
		})

		// advance time to end of clip:
		await mockTime.advanceTimeTicks(2000)

		// two commands have been sent:
		expect(commandReceiver0).toHaveBeenCalledTimes(2)
		// expect(getMockCall(commandReceiver0, 1, 1).name).toEqual('ScheduleSetCommand')
		expect(getMockCall(commandReceiver0, 1, 1).name).toEqual('ClearCommand')
		expect(getMockCall(commandReceiver0, 1, 1).channel).toEqual(2)
		expect(getMockCall(commandReceiver0, 1, 1).layer).toEqual(42)
	})

	test('CasparCG: Play decklink input for 60s', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 2,
			layer: 42
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		await myConductor.init()
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				useScheduling: true
			}
		})
		await myConductor.setMapping(myLayerMapping)

		let deviceContainer = myConductor.getDevice('myCCG')
		let device = deviceContainer.device

		// Check that no commands has been scheduled:
		expect(await device['queue']).toHaveLength(0)

		// await mockTime.advanceTimeToTicks(10050)
		// expect(commandReceiver0).toHaveBeenCalledTimes(3)

		// await mockTime.advanceTimeToTicks(10010)

		await mockTime.advanceTimeToTicks(10050)
		expect(commandReceiver0).toHaveBeenCalledTimes(3)
		expect(getMockCall(commandReceiver0, 0, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 1, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 2, 1).name).toEqual('TimeCommand')

		myConductor.timeline = [
			{
				id: 'obj0',
				enable: {
					start: 9000,
					duration: 2000 // 11000
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.INPUT,

					device: 1,
					inputType: 'decklink',
					deviceFormat: ChannelFormat.HD_720P5000
				}
			}
		]
		await mockTime.advanceTimeToTicks(10100)

		// one command has been sent:
		expect(commandReceiver0).toHaveBeenCalledTimes(5)

		expect(getMockCall(commandReceiver0, 3, 1).name).toEqual('PlayDecklinkCommand')
		expect(getMockCall(commandReceiver0, 3, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			device: 1
		})

		expect(getMockCall(commandReceiver0, 4, 1).name).toEqual('ScheduleSetCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command.name).toEqual('ClearCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command._objectParams).toMatchObject({ channel: 2, layer: 42 })

		// advance time to end of clip:
		// await mockTime.advanceTimeToTicks(11200)

		// two commands have been sent:
		// expect(commandReceiver0).toHaveBeenCalledTimes(5)
	})

	test('CasparCG: Play template for 60s', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 2,
			layer: 42
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		await myConductor.init()
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				useScheduling: true
			}
		})
		await myConductor.setMapping(myLayerMapping)

		let deviceContainer = myConductor.getDevice('myCCG')
		let device = deviceContainer.device

		// Check that no commands has been scheduled:
		expect(await device['queue']).toHaveLength(0)

		await mockTime.advanceTimeToTicks(10050)
		expect(commandReceiver0).toHaveBeenCalledTimes(3)
		expect(getMockCall(commandReceiver0, 0, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 1, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 2, 1).name).toEqual('TimeCommand')

		myConductor.timeline = [
			{
				id: 'obj0',
				enable: {
					start: 9000,
					duration: 2000
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.TEMPLATE,

					name: 'LT',
					data: {
						f0: 'Hello',
						f1: 'World'
					},
					useStopCommand: true
				}
			}
		]

		await mockTime.advanceTimeToTicks(10100)

		// one command has been sent:
		expect(commandReceiver0).toHaveBeenCalledTimes(5)
		expect(getMockCall(commandReceiver0, 3, 1).name).toEqual('CGAddCommand')
		expect(getMockCall(commandReceiver0, 3, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			noClear: false,
			templateName: 'LT',
			flashLayer: 1,
			playOnLoad: true,
			data: { f0: 'Hello', f1: 'World' },
			cgStop: true,
			templateType: 'html'
		})

		expect(getMockCall(commandReceiver0, 4, 1).name).toEqual('ScheduleSetCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command.name).toEqual('CGStopCommand')
	})

	test('CasparCG: Play template for 60s', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 2,
			layer: 42
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		await myConductor.init()
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				useScheduling: true
			}
		})
		await myConductor.setMapping(myLayerMapping)

		let deviceContainer = myConductor.getDevice('myCCG')
		let device = deviceContainer.device

		// Check that no commands has been scheduled:
		expect(await device['queue']).toHaveLength(0)

		await mockTime.advanceTimeToTicks(10050)
		expect(commandReceiver0).toHaveBeenCalledTimes(3)
		expect(getMockCall(commandReceiver0, 0, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 1, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 2, 1).name).toEqual('TimeCommand')

		myConductor.timeline = [
			{
				id: 'obj0',
				enable: {
					start: 9000,
					duration: 2000
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.RECORD,

					file: 'RECORDING',
					encoderOptions: '-format mkv -c:v libx264 -crf 22'
				}
			}
		]

		await mockTime.advanceTimeToTicks(10100)

		// one command has been sent:
		expect(commandReceiver0).toHaveBeenCalledTimes(5)
		expect(getMockCall(commandReceiver0, 3, 1).name).toEqual('CustomCommand')
		expect(getMockCall(commandReceiver0, 3, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			noClear: false,
			media: 'RECORDING',
			encoderOptions: '-format mkv -c:v libx264 -crf 22',
			command: 'ADD 2 FILE RECORDING -format mkv -c:v libx264 -crf 22',
			customCommand: 'add file'
		})

		expect(getMockCall(commandReceiver0, 4, 1).name).toEqual('ScheduleSetCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command.name).toEqual('CustomCommand')
	})

	test('CasparCG: Play 2 routes for 60s', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 2,
			layer: 42
		}
		let myLayerMapping1: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 1,
			layer: 42
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0,
			'myLayer1': myLayerMapping1
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		await myConductor.init()
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				useScheduling: true
			}
		})
		await myConductor.setMapping(myLayerMapping)

		let deviceContainer = myConductor.getDevice('myCCG')
		let device = deviceContainer.device

		// Check that no commands has been scheduled:
		expect(await device['queue']).toHaveLength(0)

		await mockTime.advanceTimeToTicks(10050)
		expect(commandReceiver0).toHaveBeenCalledTimes(3)
		expect(getMockCall(commandReceiver0, 0, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 1, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 2, 1).name).toEqual('TimeCommand')

		myConductor.timeline = [
			{
				id: 'obj0',
				enable: {
					start: 9000,
					duration: 3000
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.ROUTE,

					mappedLayer: 'myLayer1'
				}
			},
			{
				id: 'obj1',
				enable: {
					start: 11000,
					duration: 1000
				},
				layer: 'myLayer1',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.ROUTE,

					channel: 2,
					layer: 23
				}
			}
		]

		await mockTime.advanceTimeToTicks(10100)

		// one command has been sent:
		expect(commandReceiver0).toHaveBeenCalledTimes(7)
		expect(getMockCall(commandReceiver0, 3, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			noClear: false,
			routeChannel: 1,
			routeLayer: 42,
			command: 'PLAY 2-42 route://1-42',
			customCommand: 'route'
		})

		await mockTime.advanceTimeToTicks(11000)

		// expect(commandReceiver0).toHaveBeenCalledTimes(2)
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command._objectParams).toMatchObject({
			channel: 1,
			layer: 42,
			noClear: false,
			routeChannel: 2,
			routeLayer: 23,
			command: 'PLAY 1-42 route://2-23',
			customCommand: 'route'
		})

		// advance time to end of clip:
		await mockTime.advanceTimeToTicks(12000)

		// two more commands have been sent:
		// expect(commandReceiver0).toHaveBeenCalledTimes(4)
		// expect 2 clear commands:
		expect(getMockCall(commandReceiver0, 5, 1)._objectParams.command.name).toEqual('ClearCommand')
		expect(getMockCall(commandReceiver0, 6, 1)._objectParams.command.name).toEqual('ClearCommand')
	})

	test('CasparCG: AMB with transitions', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 2,
			layer: 42
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		await myConductor.init()
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				useScheduling: true
			}
		})
		await myConductor.setMapping(myLayerMapping)

		// Check that no commands has been sent:
		expect(commandReceiver0).toHaveBeenCalledTimes(0)

		await mockTime.advanceTimeToTicks(10050)
		expect(commandReceiver0).toHaveBeenCalledTimes(3)
		expect(getMockCall(commandReceiver0, 0, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 1, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 2, 1).name).toEqual('TimeCommand')

		myConductor.timeline = [
			{
				id: 'obj0',
				enable: {
					start: mockTime.getCurrentTime() - 1000, // 1 seconds ago
					duration: 2000
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.MEDIA,

					file: 'AMB',

					transitions: {
						inTransition: {
							type: Transition.MIX,
							duration: 1000,
							easing: Ease.LINEAR,
							direction: Direction.LEFT
						},
						outTransition: {
							type: Transition.MIX,
							duration: 1000,
							easing: Ease.LINEAR,
							direction: Direction.RIGHT
						}
					}
				}
			}
		]

		// fast-forward:
		await mockTime.advanceTimeTicks(100)
		// Check that an ACMP-command has been sent
		expect(commandReceiver0).toHaveBeenCalledTimes(5)
		expect(getMockCall(commandReceiver0, 3, 1).name).toEqual('PlayCommand')
		expect(getMockCall(commandReceiver0, 3, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			noClear: false,
			transition: 'MIX',
			transitionDuration: 25,
			transitionEasing: 'LINEAR',
			transitionDirection: 'LEFT',
			clip: 'AMB',
			seek: 25,
			loop: false
		})
		expect(getMockCall(commandReceiver0, 4, 1).name).toEqual('ScheduleSetCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command.name).toEqual('PlayCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			transition: 'MIX',
			transitionDuration: 25,
			transitionEasing: 'LINEAR',
			transitionDirection: 'RIGHT',
			clip: 'empty'
		})

		// Nothing more should've happened:
		await mockTime.advanceTimeToTicks(10400)

		expect(commandReceiver0.mock.calls.length).toBe(5)
	})

	test('CasparCG: Mixer commands', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 2,
			layer: 42
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		myConductor.on('error', e => { throw new Error(e) })
		myConductor.on('warning', msg => { console.warn(msg) })
		await myConductor.init()
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				useScheduling: true
			}
		})
		await myConductor.setMapping(myLayerMapping)

		// Check that no commands has been sent:
		expect(commandReceiver0).toHaveBeenCalledTimes(0)

		myConductor.timeline = [
			{
				id: 'obj0',
				enable: {
					start: mockTime.getCurrentTime() - 1000, // 1 seconds ago
					duration: 12000 // 12s
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.MEDIA, // more to be implemented later!
					file: 'AMB',
					loop: true

				},
				keyframes: [{
					id: 'kf1',
					enable: {
						start: 500, // 0 = parent's start
						duration: 5500
					},
					content: {
						mixer: {
							perspective: {
								topLeftX: 0,
								topLeftY: 0,
								topRightX: 0.5,
								topRightY: 0,
								bottomRightX: 0.5,
								bottomRightY: 1,
								bottomLeftX: 0,
								bottomLeftY: 1
							}
						}
					}

				},{
					id: 'kf2',
					enable: {
						start: 6000, // 0 = parent's start
						duration: 6000
					},
					content: {
						mixer: {
							perspective: {
								topLeftX: 0,
								topLeftY: 0,
								topRightX: 1,
								topRightY: 0,
								bottomRightX: 1,
								bottomRightY: 1,
								bottomLeftX: 0,
								bottomLeftY: 1
							}
						}
					}
				}]
			}
		]

		// fast-forward:
		await mockTime.advanceTimeTicks(100)

		// Check that ACMP-commands has been sent
		expect(commandReceiver0).toHaveBeenCalledTimes(5)
		// we've already tested play commands so let's check the mixer command:
		expect(getMockCall(commandReceiver0, 1, 1).name).toMatch(/MixerPerspectiveCommand/)
		expect(getMockCall(commandReceiver0, 1, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			topLeftX: 0,
			topLeftY: 0,
			topRightX: 0.5,
			topRightY: 0,
			bottomRightX: 0.5,
			bottomRightY: 1,
			bottomLeftX: 0,
			bottomLeftY: 1,
			keyword: 'PERSPECTIVE'
		})

		// fast-forward:
		await mockTime.advanceTimeTicks(5000)

		expect(commandReceiver0.mock.calls).toHaveLength(6)
		// expect(CasparCG.mockDo.mock.calls[2][0]).toBeInstanceOf(AMCP.StopCommand);
		expect(getMockCall(commandReceiver0, 5, 1)._objectParams.command.name).toMatch(/MixerPerspectiveCommand/)
		expect(getMockCall(commandReceiver0, 5, 1)._objectParams.command._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			topLeftX: 0,
			topLeftY: 0,
			topRightX: 1,
			topRightY: 0,
			bottomRightX: 1,
			bottomRightY: 1,
			bottomLeftX: 0,
			bottomLeftY: 1,
			keyword: 'PERSPECTIVE'
		})

	})

	test('CasparCG: loadbg command', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 2,
			layer: 42
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		await myConductor.init()
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				timeBase: 50,
				useScheduling: true
			}
		})
		await myConductor.setMapping(myLayerMapping)

		expect(mockTime.getCurrentTime()).toEqual(10000)

		await mockTime.advanceTimeToTicks(10050)
		expect(commandReceiver0).toHaveBeenCalledTimes(3)
		expect(getMockCall(commandReceiver0, 0, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 1, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 2, 1).name).toEqual('TimeCommand')

		myConductor.timeline = [
			{
				id: 'obj0_bg',
				enable: {
					start: 10000,
					duration: 1200
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.MEDIA,

					file: 'AMB',
					loop: true
				},
				// @ts-ignore
				isLookahead: true
			},
			{
				id: 'obj0',
				enable: {
					start: 11200, // 1.2 seconds in the future
					duration: 2000
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.MEDIA,

					file: 'AMB',
					loop: true
				}
			}
		]

		await mockTime.advanceTimeTicks(100)
		expect(commandReceiver0).toHaveBeenCalledTimes(5)
		expect(getMockCall(commandReceiver0, 3, 1).name).toEqual('LoadbgCommand')
		expect(getMockCall(commandReceiver0, 3, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			noClear: false,
			clip: 'AMB',
			auto: false,
			loop: true,
			seek: 0
		})
		expect(getMockCall(commandReceiver0, 4, 1).name).toEqual('ScheduleSetCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.timecode).toEqual('00:00:11:10') // 11s 10 frames == 1.2 s @50fpx

		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command.name).toEqual('PlayCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command._objectParams).toEqual({
			channel: 2,
			layer: 42,
			noClear: false
		})

		await mockTime.advanceTimeTicks(2000)
		expect(commandReceiver0).toHaveBeenCalledTimes(6)
		expect(getMockCall(commandReceiver0, 5, 1).name).toEqual('ScheduleSetCommand')
		expect(getMockCall(commandReceiver0, 5, 1)._objectParams.command.name).toEqual('ClearCommand')
		expect(getMockCall(commandReceiver0, 5, 1)._objectParams.command._objectParams).toEqual({
			channel: 2,
			layer: 42
		})

	})

	test('CasparCG: Schedule Play, then change my mind', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 2,
			layer: 42
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		await myConductor.init()
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				timeBase: 50,
				useScheduling: true
			}
		})
		await myConductor.setMapping(myLayerMapping)

		await mockTime.advanceTimeToTicks(10050)
		expect(commandReceiver0).toHaveBeenCalledTimes(3)
		expect(getMockCall(commandReceiver0, 0, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 1, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 2, 1).name).toEqual('TimeCommand')

		myConductor.timeline = [
			{
				id: 'obj0_bg',
				enable: {
					start: 10000,
					duration: 1200 // 11200
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.MEDIA,

					file: 'AMB',
					loop: true
				},
				// @ts-ignore
				isLookahead: true
			},
			{
				id: 'obj0',
				enable: {
					start: 11200, // 1.2 seconds in the future
					duration: 2000 // 13200
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.MEDIA,

					file: 'AMB',
					loop: true
				}
			}
		]

		await mockTime.advanceTimeToTicks(10100)
		expect(commandReceiver0).toHaveBeenCalledTimes(5)
		expect(getMockCall(commandReceiver0, 3, 1).name).toEqual('LoadbgCommand')
		expect(getMockCall(commandReceiver0, 3, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			noClear: false,
			clip: 'AMB',
			auto: false,
			loop: true,
			seek: 0
		})
		expect(getMockCall(commandReceiver0, 4, 1).name).toEqual('ScheduleSetCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.timecode).toEqual('00:00:11:10') // 11s 10 frames == 1.2 s @ 50 fps

		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command.name).toEqual('PlayCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command._objectParams).toEqual({
			channel: 2,
			layer: 42,
			noClear: false
		})

		let tokenPlay = getMockCall(commandReceiver0, 4, 1)._objectParams.token

		// then change my mind:
		myConductor.timeline = []
		await mockTime.advanceTimeToTicks(10200)

		expect(commandReceiver0).toHaveBeenCalledTimes(7)
		// expect(getMockCall(commandReceiver0, 3, 1).name).toEqual('ClearCommand')
		expect(getMockCall(commandReceiver0, 5, 1).name).toEqual('ScheduleRemoveCommand')
		expect(getMockCall(commandReceiver0, 5, 1)._stringParamsArray[0]).toEqual(tokenPlay)
		expect(getMockCall(commandReceiver0, 6, 1).name).toEqual('LoadbgCommand')
		expect(getMockCall(commandReceiver0, 6, 1)._objectParams).toMatchObject({
			channel: 2,
			layer: 42,
			clip: 'EMPTY'
		})

		await mockTime.advanceTimeToTicks(13000) //  10100
		expect(commandReceiver0).toHaveBeenCalledTimes(7)

	})
	test('CasparCG: Play a looping video, then continue looping', async () => {

		const commandReceiver0: any = jest.fn(() => {
			return Promise.resolve()
		})
		let myLayerMapping0: MappingCasparCG = {
			device: DeviceType.CASPARCG,
			deviceId: 'myCCG',
			channel: 1,
			layer: 10
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let myConductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})
		await myConductor.init()
		await myConductor.addDevice('myCCG', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver0,
				host: '127.0.0.1',
				timeBase: 50,
				useScheduling: true
			}
		})
		await myConductor.setMapping(myLayerMapping)

		await mockTime.advanceTimeToTicks(10050)
		expect(commandReceiver0).toHaveBeenCalledTimes(3)
		expect(getMockCall(commandReceiver0, 0, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 1, 1).name).toEqual('TimeCommand')
		expect(getMockCall(commandReceiver0, 2, 1).name).toEqual('TimeCommand')

		myConductor.timeline = [
			{
				id: 'obj0',
				enable: {
					start: 10000,
					duration: 5000 // 15000
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.MEDIA,

					file: 'AMB',
					loop: true
				}
			},
			{
				id: 'obj1',
				enable: {
					start: '#obj0.end', // 15000
					duration: 5000 // 20000
				},
				layer: 'myLayer0',
				content: {
					deviceType: DeviceType.CASPARCG,
					type: TimelineContentTypeCasparCg.MEDIA,

					file: 'AMB',
					loop: true
				}
			}
		]

		await mockTime.advanceTimeToTicks(30000)
		expect(commandReceiver0).toHaveBeenCalledTimes(5)

		expect(getMockCall(commandReceiver0, 3, 1).name).toEqual('PlayCommand')
		expect(getMockCall(commandReceiver0, 3, 1)._objectParams).toMatchObject({
			channel: 1,
			layer: 10,
			noClear: false,
			clip: 'AMB',
			loop: true,
			seek: 0
		})
		expect(getMockCall(commandReceiver0, 4, 1).name).toEqual('ScheduleSetCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.timecode).toEqual('00:00:20:00')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command.name).toEqual('ClearCommand')
		expect(getMockCall(commandReceiver0, 4, 1)._objectParams.command._objectParams).toEqual({
			channel: 1,
			layer: 10
		})
	})
})
