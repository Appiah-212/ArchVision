import { CheckCircle2, ImageIcon, UploadIcon } from 'lucide-react';
import React, { useState } from 'react';
import { useOutletContext } from 'react-router';
import {
    PROGRESS_INTERVAL_MS,
    PROGRESS_STEP,
    REDIRECT_DELAY_MS,
} from '../lib/constants';

type UploadProps = {
    onComplete?: (base64: string) => void;
};

const Upload = ({ onComplete = () => {} }: UploadProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState(0);

    const { isSignedIn } = useOutletContext<AuthContext>();

    const processFile = (selectedFile: File) => {
        if (!isSignedIn || !selectedFile) {
            return;
        }

        setFile(selectedFile);
        setProgress(0);

        const reader = new FileReader();
        reader.onerror = () => {
            setFile(null);
            setProgress(0);
        }

        reader.onload = () => {
            const result = reader.result;
            const base64 = typeof result === 'string' ? result.split(',')[1] ?? result : '';

            if (!base64) {
                setProgress(0);
                return;
            }

            const intervalId = window.setInterval(() => {
                setProgress((currentProgress) => {
                    const nextProgress = Math.min(currentProgress + PROGRESS_STEP, 100);

                    if (nextProgress >= 100) {
                        window.clearInterval(intervalId);
                        window.setTimeout(() => {
                            onComplete(base64);
                        }, REDIRECT_DELAY_MS);
                    }

                    return nextProgress;
                });
            }, PROGRESS_INTERVAL_MS);
        };

        reader.readAsDataURL(selectedFile);
    };

    const handleFiles = (selectedFiles: FileList | File[] | null) => {
        if (!isSignedIn) {
            return;
        }

        const selectedFile = selectedFiles?.[0];

        if (!selectedFile) {
            return;
        }

        processFile(selectedFile);
    };

    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(event.target.files);
        event.target.value = '';
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        if (!isSignedIn) {
            return;
        }

        setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);

        if (!isSignedIn) {
            return;
        }

        handleFiles(event.dataTransfer.files);
    };

    return (
        <div className="upload">
            {!file ? (
                <div
                    className={`dropzone ${isDragging ? 'is-dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        className="drop-input"
                        accept=".jpg,.jpeg,.png"
                        disabled={!isSignedIn}
                        onChange={onChange}
                    />

                    <div className="drop-content">
                        <div className="drop-icon">
                            <UploadIcon size={20} />
                        </div>
                        <p>
                            {isSignedIn ? (
                                'Click to upload or just drag and drop'
                            ) : (
                                'Sign in or sign up with Puter to upload'
                            )}
                        </p>
                        <p className="help">Maximum file size 50 MB.</p>
                    </div>
                </div>
            ) : (
                <div className="upload-status">
                    <div className="status-content">
                        <div className="status-icon">
                            {progress === 100 ? (
                                <CheckCircle2 className="check" />
                            ) : (
                                <ImageIcon className="image" />
                            )}
                        </div>

                        <h3>{file.name}</h3>

                        <div className="progress">
                            <div className="bar" style={{ width: `${progress}%` }} />

                            <p className="status-text">
                                {progress < 100 ? 'Analyzing Floor Plan ...' : 'Redirecting ...'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Upload;