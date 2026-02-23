import AVFoundation
import CoreMedia
import Foundation
import ScreenCaptureKit

final class AudioCaptureOutput: NSObject, SCStreamOutput {
    private let targetSampleRate: Double
    private let outputFormat: AVAudioFormat
    private var converter: AVAudioConverter?
    private var inputFormat: AVAudioFormat?
    private let outputHandle = FileHandle.standardOutput

    init(targetSampleRate: Double) {
        self.targetSampleRate = targetSampleRate
        self.outputFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: targetSampleRate,
            channels: 1,
            interleaved: true
        )!
        super.init()
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        guard outputType == .audio else { return }
        guard CMSampleBufferIsValid(sampleBuffer) else { return }

        guard let pcmBuffer = makePCMBuffer(from: sampleBuffer) else { return }

        if inputFormat == nil || converter == nil {
            inputFormat = pcmBuffer.format
            converter = AVAudioConverter(from: pcmBuffer.format, to: outputFormat)
        }

        guard let converter else { return }

        let ratio = outputFormat.sampleRate / pcmBuffer.format.sampleRate
        let outputCapacity = AVAudioFrameCount(Double(pcmBuffer.frameLength) * ratio + 32)
        guard let converted = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: outputCapacity) else {
            return
        }

        var conversionError: NSError?
        let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
            outStatus.pointee = .haveData
            return pcmBuffer
        }

        converter.convert(to: converted, error: &conversionError, withInputFrom: inputBlock)
        if conversionError != nil {
            return
        }

        let frameLength = Int(converted.frameLength)
        guard frameLength > 0 else { return }
        guard let int16Data = converted.int16ChannelData else { return }

        let byteCount = frameLength * MemoryLayout<Int16>.size
        let data = Data(bytes: int16Data.pointee, count: byteCount)
        do {
            try outputHandle.write(contentsOf: data)
        } catch {
            // stdout closed by parent; ignore
        }
    }

    private func makePCMBuffer(from sampleBuffer: CMSampleBuffer) -> AVAudioPCMBuffer? {
        guard let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer),
              let streamDescription = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription) else {
            return nil
        }

        guard let format = AVAudioFormat(streamDescription: streamDescription) else {
            return nil
        }

        let numSamples = CMSampleBufferGetNumSamples(sampleBuffer)
        guard numSamples > 0 else { return nil }

        guard let pcmBuffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: AVAudioFrameCount(numSamples)
        ) else {
            return nil
        }
        pcmBuffer.frameLength = AVAudioFrameCount(numSamples)

        let audioBufferList = pcmBuffer.mutableAudioBufferList
        let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(
            sampleBuffer,
            at: 0,
            frameCount: Int32(numSamples),
            into: audioBufferList
        )
        if status != noErr {
            return nil
        }

        return pcmBuffer
    }
}

func parseSampleRate() -> Int {
    let args = CommandLine.arguments
    if let idx = args.firstIndex(of: "--sample-rate"), idx + 1 < args.count {
        if let value = Int(args[idx + 1]), value > 0 {
            return value
        }
    }
    return 16_000
}

func loadShareableContent() throws -> SCShareableContent {
    let semaphore = DispatchSemaphore(value: 0)
    var loadedResult: Result<SCShareableContent, Error>?

    Task {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            loadedResult = .success(content)
        } catch {
            loadedResult = .failure(error)
        }
        semaphore.signal()
    }

    _ = semaphore.wait(timeout: .now() + 15)

    if let loadedResult {
        switch loadedResult {
        case .success(let content):
            return content
        case .failure(let error):
            throw error
        }
    }
    throw NSError(domain: "KanpeSysAudio", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to load shareable content"])
}

func main() {
    let sampleRate = parseSampleRate()

    do {
        let content = try loadShareableContent()
        guard let display = content.displays.first else {
            fputs("No display available for ScreenCaptureKit audio capture\n", stderr)
            return
        }

        let filter = SCContentFilter(display: display, excludingWindows: [])
        let configuration = SCStreamConfiguration()
        configuration.capturesAudio = true
        configuration.sampleRate = sampleRate
        configuration.channelCount = 1
        configuration.excludesCurrentProcessAudio = true
        configuration.queueDepth = 3

        let output = AudioCaptureOutput(targetSampleRate: Double(sampleRate))
        let stream = SCStream(filter: filter, configuration: configuration, delegate: nil)
        try stream.addStreamOutput(output, type: .audio, sampleHandlerQueue: DispatchQueue(label: "kanpe.sysaudio"))

        let semaphore = DispatchSemaphore(value: 0)
        var startError: Error?
        stream.startCapture { error in
            startError = error
            semaphore.signal()
        }

        _ = semaphore.wait(timeout: .now() + 10)

        if let startError {
            throw startError
        }

        RunLoop.current.run()
    } catch {
        fputs("ScreenCaptureKit audio capture failed: \(error.localizedDescription)\n", stderr)
    }
}

main()
