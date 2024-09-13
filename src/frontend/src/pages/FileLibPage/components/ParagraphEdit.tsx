import FileView from "@/components/bs-comp/FileView";
import { LoadIcon } from "@/components/bs-icons";
import { Button } from "@/components/bs-ui/button";
import { useToast } from "@/components/bs-ui/toast/use-toast";
import { getFileBboxApi, getFilePathApi, getKnowledgeChunkApi, updateChunkApi, updatePreviewChunkApi } from "@/controllers/API";
import { captureAndAlertRequestErrorHoc } from "@/controllers/request";
import { Crosshair2Icon, InfoCircledIcon } from "@radix-ui/react-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import Markdown from './Markdown';

// 上传预览时携带chunks
const ParagraphEdit = ({
    chunks = null,
    partitions = null,
    oriFilePath = '',
    isUns = true,
    filePath = '',
    fileId,
    chunkId,
    onClose
}) => {
    const { id } = useParams();
    const [value, setValue] = useState('');
    const [data, setData] = useState([]);
    const prevOvergapData = useRef(null);
    const { t } = useTranslation('knowledge')

    const labelTexts = useLabelTexts(fileId, partitions)
    const [previewFileUrl, setFileUrl] = useState('')
    useEffect(() => {
        chunks ? setFileUrl(filePath) : getFilePathApi(fileId).then(setFileUrl)
    }, [fileId, filePath, chunks])

    const [fileName, setFileName] = useState('')
    const initData = (res) => {
        let labelsData = []
        let value = ''

        res.data.forEach(chunk => {
            const { bbox, chunk_index } = chunk.metadata
            const labels = bbox && JSON.parse(bbox).chunk_bboxes || []

            const active = chunk_index === chunkId
            const resData = labels.map(label => {
                return {
                    id: [label.page, ...label.bbox].join('-'),
                    page: label.page,
                    label: label.bbox,
                    active,
                    txt: chunk.text
                }
            })

            labelsData = [...labelsData, ...resData]

            if (active) {
                value = chunk.text
            }
        })
        setFileName(res.data[0].metadata.source)
        setData(labelsData)
        prevOvergapData.current = labelsData
        setValue(value)
        // 自动滚动到当前chunk
        setRandom(Math.random() / 10000)
    }
    useEffect(() => {
        chunks ? initData({ data: chunks }) : getKnowledgeChunkApi({ knowledge_id: id, file_ids: [fileId], limit: 1000 }).then(initData)
    }, [])

    const markDownRef = useRef(null)
    const { leftPanelWidth, handleMouseDown } = useDragSize(!isUns)
    const [labelChange, setLabelChange] = useState(false)
    const { message } = useToast()

    const [loading, setLoading] = useState(false)
    const handleSave = async () => {
        const _value = markDownRef.current.getValue().trim()
        setValue(_value)
        if (!_value) return

        const bbox = {
            chunk_bboxes: prevOvergapData.current.reduce((arr, item) => {
                if (item.active) {
                    arr.push({ page: item.page, bbox: item.label })
                }
                return arr
            }, [])
        }

        setLoading(true)

        const promise = chunks ? updatePreviewChunkApi({
            knowledge_id: Number(id), file_path: oriFilePath, chunk_index: chunkId, text: _value, bbox: JSON.stringify(bbox)
        }) : updateChunkApi({
            knowledge_id: Number(id), file_id: fileId, chunk_index: chunkId, text: _value, bbox: JSON.stringify(bbox)
        })
        await captureAndAlertRequestErrorHoc(promise.then(res => {
            message({ variant: 'success', description: t('editSuccess') })
            onClose()
        }))
        setLoading(false)
    }

    const labels = useMemo(() => {
        return data.reduce((acc, item) => {
            if (!acc[item.page]) {
                acc[item.page] = [];
            }
            acc[item.page].push({ ...item });

            return acc;
        }, {});
    }, [data]);

    const handleSelectLabels = (lbs) => {
        let arr = data
        lbs.forEach((item) => {
            arr = arr.map(el => el.id === item.id ? { ...el, active: item.active } : el)
        })
        setData(arr)
        // console.log('arr :>> ', lbs, arr);

        setLabelChange(true)
    }

    const handleOvergap = () => {
        setLabelChange(false)
        let prevType = ''
        let str = ''
        // 标注块拼接段落
        data.forEach((item) => {
            if (typeof labelTexts[item.id] === 'string') return window.alter('文件已失效，传个新的在测试')
            if (item.active) {
                const { text, type } = labelTexts[item.id]
                if (str === '') {
                    // 第一个块, title类型，末尾加单换行
                    str += text + (type === 'Title' ? '\n' : '')
                } else {
                    // 非第一个块
                    // 上一个是表格 or 当前是表格 or 当前是title并上一个不是title
                    if (prevType === 'Table' || type === 'Table' || (type === 'Title' && prevType !== type)) {
                        str += '\n\n' + text
                    } else {
                        str += '\n' + text
                    }
                }

                prevType = type
            }
        })
        console.log('JSON. :>> ', JSON.stringify(str));
        setValue(str)
        markDownRef.current.setValue(str) // fouceupdate
        prevOvergapData.current = data
    }

    const [random, setRandom] = useState(0)
    const postion = useMemo(() => {
        const target = data.find(el => el.active)
        return target ? [target.page, target.label[1] + random] : [1, 0]
    }, [random])

    const [showPos, setShowPos] = useState(false)
    const handlePageChange = (offset, h, paperSize, scale) => {
        if (offset === 0) return
        // console.log('data :>> ', data, offset, h, paperSize, scale);
        setShowPos(!data.some(item => {
            const pageHeight = (item.page - 1) * paperSize
            const labelTop = pageHeight + item.label[1] / scale
            return item.active && labelTop > offset && labelTop < (offset + h)
        }))
    }

    return (
        <div className="flex px-4 py-2 select-none">
            {/* left */}
            <div className="relative" style={{ width: leftPanelWidth }}>
                <Markdown ref={markDownRef} isUns={isUns} title={fileName} q={chunkId + 1} value={value} />
                {!value && <p className="absolute left-0 text-red-500 text-xs mt-2">{t('inputNotEmpty')}</p>}
                {!isUns && <div className="flex justify-end gap-4">
                    <Button className="px-6 h-8" variant="outline" onClick={onClose}>{t('cancel', { ns: 'bs' })}</Button>
                    <Button className="px-6 h-8" disabled={loading} onClick={handleSave}><LoadIcon className={`mr-1 ${loading ? '' : 'hidden'}`} />{t('save', { ns: 'bs' })}</Button>
                </div>}
            </div>
            {isUns && <>
                {/* drag line */}
                <div className="h-full p-2">
                    <div
                        className="h-full w-1 border cursor-ew-resize"
                        onMouseDown={handleMouseDown}
                    ></div>
                </div>
                {/* right */}
                <div className="flex-1">
                    {/* head */}
                    <div className="flex justify-between items-center relative h-10 mb-2 text-sm">
                        <span>{fileName}</span>
                        <div className={`${labelChange ? '' : 'hidden'} flex items-center`}>
                            <InfoCircledIcon className='mr-1 text-red-500' />
                            <span className="text-red-500">{t('segmentRangeDetected')}</span>
                            <span className="text-primary cursor-pointer" onClick={handleOvergap}>{t('overwriteSegment')}</span>
                        </div>
                        <div className="flex justify-end gap-4">
                            <Button className="px-6 h-8" variant="outline" onClick={onClose}>{t('cancel', { ns: 'bs' })}</Button>
                            <Button className="px-6 h-8" disabled={loading} onClick={handleSave}><LoadIcon className={`mr-1 ${loading ? '' : 'hidden'}`} />{t('save', { ns: 'bs' })}</Button>
                        </div>
                    </div>
                    {/* file view */}
                    <div className="bg-gray-100 relative">
                        {showPos && value && Object.keys(labels).length !== 0 && <Button className="absolute top-2 right-2 z-10 bg-background" variant="outline" onClick={() => setRandom(Math.random() / 10000)}><Crosshair2Icon className="mr-1" />{t('backToPosition')}</Button>}
                        <div className="h-[calc(100vh-104px)]">
                            {previewFileUrl && <FileView
                                select
                                fileUrl={previewFileUrl}
                                labels={labels}
                                scrollTo={postion}
                                onSelectLabel={handleSelectLabels}
                                onPageChange={handlePageChange}
                            />}
                        </div>
                    </div>
                </div>
            </>}
        </div>
    );
};

const useDragSize = (full) => {
    const [leftPanelWidth, setLeftPanelWidth] = useState(full ? '100%' : window.innerWidth * 0.4);
    const [isDragging, setIsDragging] = useState(false);

    const handleMouseDown = useCallback(() => {
        setIsDragging(true);
    }, []);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseMove = useCallback(
        (e) => {
            if (isDragging) {
                const newWidth = e.clientX - 24;
                if (newWidth >= 320 && newWidth <= window.innerWidth * 0.7) {
                    setLeftPanelWidth(newWidth);
                }
            }
        },
        [isDragging]
    );

    React.useEffect(() => {
        if (full) return
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [full, isDragging, handleMouseMove, handleMouseUp]);

    return { leftPanelWidth, handleMouseDown };
}

// 标注文本数据
const useLabelTexts = (fileId: string, partitions: any) => {
    const [labelText, setLabelText] = useState<any>({});
    useEffect(() => {
        partitions ?
            setLabelText(partitions)
            : getFileBboxApi(fileId).then(res => {
                setLabelText(res)
            })
    }, [])

    return labelText;
}

export default ParagraphEdit;
