

doughnut chart
--------------

(1) add files: 

```
charts/chartX.xml
charts/colorsX.xml
charts/styleX.xml
charts/_rels/chartX.xml.rels [number matches chartX.xml]

drawings/drawingX.xml
drawings/_rels/drawingX.xml.rels [number matches drawingX.xml]
```

(2) add types to [Content_Types].xml

```
<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
<Override PartName="/xl/charts/style1.xml" ContentType="application/vnd.ms-office.chartstyle+xml"/>
<Override PartName="/xl/charts/colors1.xml" ContentType="application/vnd.ms-office.chartcolorstyle+xml"/>
```

(3) worksheet xml has reference to drawing

```
<drawing r:id="rId1"/>
```

(4) worksheet rels points to drawing file

```
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
```

(5) drawing file has reference to chart

```
<c:chart
	xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>
```

(6) drawing rels points to chart

```
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
```

(7) chart has no reference to colors, style? (...)

(8) chart rels has rels to colors, style

```
<Relationship Id="rId2" Type="http://schemas.microsoft.com/office/2011/relationships/chartColorStyle" Target="colors1.xml"/>
<Relationship Id="rId1" Type="http://schemas.microsoft.com/office/2011/relationships/chartStyle" Target="style1.xml"/>
```

given that there's no reference in chart, not clear that we need these (although knowing Excel...)






