"""One isolated PDFium operation per process. No script, link or attachment execution."""
import base64
import io
import json
import math
import sys
import time
from contextlib import closing
import pypdfium2 as pdfium


def matches(textpage,query,limit=200):
    if not query:return []
    found=[]
    with closing(textpage.search(query,match_case=False)) as search:
        while len(found)<limit:
            item=search.get_next()
            if item is None:break
            found.append(item)
    return found


def process(data):
    try:doc=pdfium.PdfDocument(data['path'])
    except pdfium.PdfiumError as error:
        if error.err_code==4:raise ValueError('PDF 已加密，请先用其他应用解锁后再预览') from None
        raise ValueError('PDF 无法读取，文件可能损坏或不受支持') from None
    with doc:
        count=len(doc)
        if count<1 or count>10000:raise ValueError('PDF 页数无效或超过 10000 页')
        action=data.get('action','info')
        if action=='info':
            outline=[]
            for bookmark in doc.get_toc(max_depth=12):
                if len(outline)>=1000:break
                dest=bookmark.get_dest();index=dest.get_index() if dest else None
                if index is not None and 0<=index<count:
                    outline.append({'level':bookmark.level+1,'title':bookmark.get_title()[:300],'page':index+1})
            with closing(doc[0]) as page:width,height=page.get_size()
            return {'pageCount':count,'outline':outline,'pageWidth':width,'pageHeight':height}
        number=data.get('page',1)
        if not 1<=number<=count:raise ValueError('页码超出 PDF 范围')
        query=data.get('query','')
        if action=='search':
            start=time.monotonic();results=[];scanned=number-1;total=0
            for index in range(number-1,min(count,number-1+25)):
                with closing(doc[index]) as page, closing(page.get_textpage()) as text:
                    hits=matches(text,query)
                    if hits:results.append({'page':index+1,'count':len(hits)})
                    total+=len(hits)
                scanned=index+1
                if time.monotonic()-start>2 or total>=1000:break
            return {'matches':results,'scanned':scanned,'nextPage':scanned+1 if scanned<count else None,'pageCount':count}
        with closing(doc[number-1]) as page:
            width,height=page.get_size()
            if not all(math.isfinite(v) and v>0 for v in (width,height)):raise ValueError('PDF 页面尺寸异常')
            scale=min(float(data.get('scale',1.5)),math.sqrt(6000000/(width*height)),8000/max(width,height))
            if scale<.01:raise ValueError('PDF 页面尺寸过大')
            with closing(page.render(scale=scale,may_draw_forms=False)) as bitmap:
                image=bitmap.to_pil();out=io.BytesIO();image.save(out,format='PNG');blob=out.getvalue();mime='image/png'
                if len(blob)>8*1024*1024:
                    out=io.BytesIO();image.convert('RGB').save(out,format='JPEG',quality=85);blob=out.getvalue();mime='image/jpeg'
                if len(blob)>10*1024*1024:raise ValueError('PDF 页面图像过大')
            boxes=[]
            if query:
                with closing(page.get_textpage()) as text:
                    text.count_rects()
                    rotation=page.get_rotation()
                    # Boxes are in unrotated PDF coordinates. Only overlay them on unrotated pages.
                    for index,length in matches(text,query,100) if rotation==0 else []:
                        for offset in range(min(text.count_rects(index,length),20)):
                            left,bottom,right,top=text.get_rect(offset)
                            boxes.append([left/width,(height-top)/height,(right-left)/width,(top-bottom)/height])
            return {'page':number,'pageCount':count,'pageWidth':width,'pageHeight':height,
                    'mimeType':mime,'blob':base64.b64encode(blob).decode('ascii'),'boxes':boxes[:200]}


if __name__=='__main__':
    try:result=process(json.loads(sys.stdin.buffer.read(32768).decode('utf-8')))
    except Exception as error:
        result={'error':str(error) if isinstance(error,ValueError) else '此 PDF 无法处理，请尝试其他查看器'}
    sys.stdout.buffer.write(json.dumps(result,ensure_ascii=False).encode('utf-8'))
