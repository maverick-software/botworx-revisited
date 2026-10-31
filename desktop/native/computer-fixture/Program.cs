using System.Drawing;
using System.Text.Json;
using System.Windows.Forms;
class Fixture:Form
{
 readonly string file;string visual;readonly TextBox note;readonly Label receipt;readonly System.Windows.Forms.Timer watch=new(){Interval=200};int count;
 public Fixture(string file,string visual,string? cardFile=null,string? events=null)
 {
  this.file=file;this.visual=visual;Text="Sylvana Computer Verification";StartPosition=FormStartPosition.Manual;Location=new Point(100,100);ClientSize=new Size(760,500);BackColor=Color.FromArgb(248,248,248);Font=new Font("Segoe UI",12);
  var title=new Label{Text="Windows computer-use verification",AutoSize=true,Location=new Point(25,20)};
  var label=new Label{Text="Note",AutoSize=true,Location=new Point(25,85)};
  note=new TextBox{AccessibleName="Verification note",Name="note",Location=new Point(90,80),Width=420};
  if(events!=null){Application.AddMessageFilter(new InputTrace(events));note.TextChanged+=(_,_)=>File.AppendAllText(events,JsonSerializer.Serialize(new{kind="text",length=note.Text.Length})+"\n");}
  var apply=new Button{Text="Apply note",AccessibleName="Apply verification note",Location=new Point(530,78),Size=new Size(170,38)};
  receipt=new Label{Text="No note applied",AutoSize=true,Location=new Point(25,145)};
  apply.Click+=(_,_)=>{count++;receipt.Text="Applied: "+note.Text;File.WriteAllText(file,JsonSerializer.Serialize(new{count,text=note.Text}));};
  var panel=new Panel{Location=new Point(25,210),Size=new Size(680,160),BackColor=Color.FromArgb(25,67,81),AccessibleName="Visual verification card"};
  panel.Paint+=(_,e)=>{using var font=new Font("Segoe UI",23,FontStyle.Bold);e.Graphics.DrawString(this.visual,font,Brushes.White,new PointF(18,25));for(int n=0;n<3;n++)e.Graphics.FillEllipse(Brushes.Gold,25+n*55,100,28,28);if(cardFile!=null)File.WriteAllText(cardFile+".painted",this.visual);};
  if(cardFile!=null){watch.Tick+=(_,_)=>{try{string value=File.ReadAllText(cardFile).Trim();if(value!=this.visual){this.visual=value;panel.Invalidate();}}catch(IOException){}};watch.Start();}
  var modal=new Button{Text="Open details",AccessibleName="Open verification details",Location=new Point(25,405),Size=new Size(180,38)};
  modal.Click+=(_,_)=>{using var child=new Form{Text="Verification details",ClientSize=new Size(380,180),StartPosition=FormStartPosition.CenterParent};var close=new Button{Text="Done",AccessibleName="Close verification details",Location=new Point(130,85),Size=new Size(120,35)};close.Click+=(_,_)=>child.Close();child.Controls.Add(close);child.ShowDialog(this);};
  var expand=new Button{Text="Larger window",AccessibleName="Expand verification window",Location=new Point(230,405),Size=new Size(180,38)};expand.Click+=(_,_)=>ClientSize=new Size(1800,1200);
  var restore=new Button{Text="Restore size",AccessibleName="Restore verification size",Location=new Point(435,405),Size=new Size(180,38)};restore.Click+=(_,_)=>ClientSize=new Size(760,500);
  Controls.AddRange([title,label,note,apply,receipt,panel,modal,expand,restore]);
 }
 [STAThread]static void Main(string[] args){if(args.Length<2||args.Length>4)return;ApplicationConfiguration.Initialize();Application.Run(new Fixture(args[0],args[1],args.Length>=3&&!string.IsNullOrWhiteSpace(args[2])?args[2]:null,args.Length==4?args[3]:null));}
}
class InputTrace(string file):IMessageFilter
{
 public bool PreFilterMessage(ref Message message)
 {
  int code=message.Msg;long keys=message.WParam.ToInt64();
  if(code is 0x201 or 0x202 or 0x203 or 0x204 or 0x205 or 0x206 or 0x207 or 0x208 or 0x209 or 0x20A or 0x20E||code==0x200&&(keys&1)!=0)
   File.AppendAllText(file,JsonSerializer.Serialize(new{kind="mouse",code,keys,delta=(short)((keys>>16)&0xffff),buttons=(int)Control.MouseButtons})+"\n");
  return false;
 }
}
