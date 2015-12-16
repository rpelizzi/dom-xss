<?php
error_reporting( error_reporting() & ~E_NOTICE );
function f($s) {
  return $s; // TODO: add filtering options
}
?>
<!DOCTYPE html>
<html>
<head>
  <title>Reflected XSS Vulnerable Page<?=f($_GET["title"])?></title>
  <?=$_GET["head"]?>
</head>
<body>
<?=f($_GET["body"])?>
<script type="text/javascript">
  var a = "this is a <?=$_GET["jsstring"]?>";
  <?=$_GET["jscode"]?>
  var a = "<?=$_GET["eval"]?>";
  if (a)
    eval(a);
  var b = "<?=$_GET["setTimeout"]?>";
  if (b)
    setTimeout(b, 0);
  var c = "<?=$_GET["function"]?>";
  if (c)
    (new Function(c))();
</script>
<img id="<?=$_GET["attr"] || "aaa"?>" src=""/>

</body>
</html>
