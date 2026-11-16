"""Bounded, literal CSV preview. Values are strings; formulas are never evaluated."""
import csv
import io

MAX_ROWS=5000
MAX_COLUMNS=100
MAX_CELLS=100000
MAX_CHARACTERS=1000000


def csv_preview(text, delimiter=None):
    sample=text[:32768]
    if delimiter is None:
        try:delimiter=csv.Sniffer().sniff(sample,delimiters=',;\t|').delimiter
        except csv.Error:delimiter=','
    rows=[];cells=0;characters=0;truncated=False;columns=0;column_truncated=False
    old_limit=csv.field_size_limit()
    try:
        csv.field_size_limit(1024*1024)
        reader=csv.reader(io.StringIO(text,newline=''),delimiter=delimiter,strict=True)
        for row in reader:
            if not row:continue
            if len(row)>MAX_COLUMNS:column_truncated=True
            row=row[:MAX_COLUMNS]
            if len(rows)>=MAX_ROWS or cells+len(row)>MAX_CELLS or characters+sum(map(len,row))>MAX_CHARACTERS:
                truncated=True;break
            rows.append(row);cells+=len(row);characters+=sum(map(len,row));columns=max(columns,len(row))
        return {'rows':rows,'columns':columns,'delimiter':delimiter,'truncated':truncated,
                'columnTruncated':column_truncated,'maxRows':MAX_ROWS,'maxColumns':MAX_COLUMNS}
    except csv.Error as error:
        return {'error':'CSV 结构无法可靠解析，可切换原文查看。','detail':str(error)[:120]}
    finally:csv.field_size_limit(old_limit)
