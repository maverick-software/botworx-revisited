const {deflateSync,crc32}=require('node:zlib');
const width=32,height=24,header=Buffer.alloc(13),pixels=Buffer.alloc(height*(1+width*3));header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels.set((Math.floor(x/4)+Math.floor(y/4))%2?[165,107,255]:[245,243,255],y*(1+width*3)+1+x*3);
function chunk(name,data){const type=Buffer.from(name),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([length,type,data,checksum]);}
module.exports.png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
