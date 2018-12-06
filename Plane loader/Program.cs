using System;
using System.Collections.Generic;
using System.IO;

namespace Plane_loader
{
    class Program
    {
        static void Main(string[] args)
        {
            string line;
            var lst = new List<string[]>();
            using (StreamReader sr = new StreamReader("fuel_consumption.txt"))
            {
                while ((line = sr.ReadLine()) != null)
                {
                    lst.Add(line.Split(new string[] { ";;;" }, StringSplitOptions.None));
                }
            }
            using(StreamWriter sw = new StreamWriter("selects.txt")){
                foreach(var item in lst){
                    sw.WriteLine($"INSERT INTO airplanes (name, fuel_consumption, max_speed, img_url) VALUES ('{item[0]}',{item[1]},{item[2]},'{item[3]}');");
                }
            }
        }
    }
}
